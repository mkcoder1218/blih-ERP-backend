import { Op } from "sequelize";
import { db } from "../../models";
import { ROLE_DOMAIN_MAP, roleDomainsForKey, roleHasAllDomains } from "../../models/Role";
import { expandPermissionDependencies } from "../permission/permission.metadata";
import { RoleDAL } from "./role.dal";

export class RoleService {
  private dal: RoleDAL;

  constructor() {
    this.dal = new RoleDAL();
  }

  private async permissionsForKeys(keys: string[]) {
    const allPermissions = await db.Permission.findAll({
      attributes: ["id", "key", "module", "action", "description"]
    });
    const plain = allPermissions.map((permission: any) => permission.toJSON ? permission.toJSON() : permission);
    const expandedKeys = expandPermissionDependencies(keys, plain);
    return allPermissions.filter((permission: any) => expandedKeys.includes(permission.key));
  }

  private assertRoleInBusiness(role: any, businessId: string) {
    if (role.businessId !== businessId && role.businessId !== null) {
      throw Object.assign(new Error("Role not found"), { statusCode: 404 });
    }
  }

  private assertCustomRole(role: any) {
    if (role.isSystemRole) {
      throw Object.assign(new Error("System roles are protected and cannot be modified"), { statusCode: 403 });
    }
  }

  private assertDomain(role: any, callerRoleKeys?: string[]) {
    if (!callerRoleKeys) return;
    const isAdmin = callerRoleKeys.some((key) => roleHasAllDomains(key));
    if (isAdmin) return;
    const ownedDomains = Array.from(new Set(callerRoleKeys.flatMap((key) => roleDomainsForKey(key))));
    if (role.domain && !ownedDomains.includes(role.domain)) {
      throw Object.assign(new Error("You can only manage roles in your domain"), { statusCode: 403 });
    }
  }

  async create(businessId: string, data: any) {
    let permissionKeys: string[] = Array.isArray(data.permissionKeys) ? data.permissionKeys : [];

    if (data.copyFromRoleId) {
      const source = await db.Role.findByPk(data.copyFromRoleId, { include: [{ model: db.Permission }] });
      if (!source) throw Object.assign(new Error("Source role not found"), { statusCode: 404 });
      this.assertRoleInBusiness(source, businessId);
      permissionKeys = (source.Permissions || []).map((permission: any) => String(permission.key));
    }

    const permissions = permissionKeys.length ? await this.permissionsForKeys(permissionKeys) : [];
    const role = await this.dal.create({
      businessId,
      name: data.name,
      key: data.key,
      description: data.description || null,
      domain: data.domain || null,
      isSystemRole: false
    });

    if (permissions.length) await role.setPermissions(permissions);
    return this.getById(role.id);
  }

  async list(businessId?: string) {
    const where: any = { deletedAt: null };
    if (businessId) where.businessId = businessId;
    const roles = await this.dal.findAll(where, { order: [["isSystemRole", "DESC"], ["name", "ASC"]] });
    return Promise.all(
      roles.map(async (role: any) => {
        const plain = role.toJSON ? role.toJSON() : role;
        const userCount = await role.countUsers();
        return { ...plain, userCount };
      })
    );
  }

  async listForCaller(businessId: string, callerRoleKeys: string[]) {
    const isAdmin = callerRoleKeys.some((key) => roleHasAllDomains(key));
    if (isAdmin) return this.list(businessId);

    const ownedDomains = Array.from(new Set(callerRoleKeys.flatMap((key) => roleDomainsForKey(key))));
    if (ownedDomains.length === 0) return [];

    const ownedRoleKeys = Object.entries(ROLE_DOMAIN_MAP)
      .filter(([key]) => roleDomainsForKey(key).some((domain) => ownedDomains.includes(domain)))
      .map(([key]) => key);

    const roles = await this.dal.findAll(
      {
        businessId,
        deletedAt: null,
        [Op.or]: [
          { domain: { [Op.in]: ownedDomains } },
          { key: { [Op.in]: ownedRoleKeys } }
        ],
      },
      { order: [["isSystemRole", "DESC"], ["name", "ASC"]] }
    );

    return Promise.all(
      roles.map(async (role: any) => {
        const plain = role.toJSON ? role.toJSON() : role;
        const userCount = await role.countUsers();
        return { ...plain, userCount };
      })
    );
  }

  async getById(id: string) {
    const role = await this.dal.findById(id, { include: [{ model: db.Permission }] });
    if (!role) return null;
    const plain = role.toJSON ? role.toJSON() : role;
    const userCount = await role.countUsers();
    return { ...plain, userCount };
  }

  async update(id: string, businessId: string, data: any, callerRoleKeys?: string[]) {
    const role = await db.Role.findOne({ where: { id, businessId } });
    if (!role) return null;
    this.assertCustomRole(role);
    this.assertDomain(role, callerRoleKeys);

    await role.update({
      name: data.name !== undefined ? data.name : role.name,
      key: data.key !== undefined ? data.key : role.key,
      description: data.description !== undefined ? data.description : role.description,
      domain: data.domain !== undefined ? data.domain : role.domain,
    });

    if (Array.isArray(data.permissionKeys)) {
      const permissions = await this.permissionsForKeys(data.permissionKeys);
      await role.setPermissions(permissions);
    }

    return this.getById(role.id);
  }

  async duplicate(id: string, businessId: string, data: any) {
    const source = await db.Role.findByPk(id, { include: [{ model: db.Permission }] });
    if (!source) return null;
    this.assertRoleInBusiness(source, businessId);

    return this.create(businessId, {
      name: data.name,
      key: data.key,
      description: data.description ?? source.description,
      domain: data.domain ?? source.domain,
      permissionKeys: (source.Permissions || []).map((permission: any) => String(permission.key)),
    });
  }

  async listUsers(id: string, businessId: string | undefined, page: number, size: number, search?: string) {
    const role = await db.Role.findByPk(id);
    if (!role) return null;
    if (role.businessId && businessId && role.businessId !== businessId) return null;

    const where: any = {};
    if (businessId) where.businessId = businessId;
    else if (role.businessId) where.businessId = role.businessId;

    if (search) {
      where[Op.or] = [
        { fullName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const result = await db.User.findAndCountAll({
      where,
      attributes: ["id", "fullName", "email", "phone", "status", "lastLoginAt"],
      include: [{
        model: db.Role,
        where: { id },
        through: { attributes: [] },
        attributes: [],
        required: true,
      }],
      distinct: true,
      order: [["fullName", "ASC"]],
      limit: size,
      offset: (page - 1) * size,
    });

    return {
      rows: result.rows,
      count: result.count,
      page,
      size,
      pages: Math.max(1, Math.ceil(result.count / size)),
    };
  }

  async archive(id: string, businessId: string, callerRoleKeys?: string[]) {
    const role = await db.Role.findOne({ where: { id, businessId } });
    if (!role) return null;
    this.assertCustomRole(role);
    this.assertDomain(role, callerRoleKeys);
    const before = role.toJSON ? role.toJSON() : role;
    const userCount = await role.countUsers();
    await role.destroy();
    return { role: { ...before, userCount }, userCount };
  }
}
