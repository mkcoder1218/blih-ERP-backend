import { RoleDAL } from "./role.dal";
import { db } from "../../models";

export class RoleService {
  private dal: RoleDAL;

  constructor() {
    this.dal = new RoleDAL();
  }

  async create(businessId: string, data: any) {
    const role = await this.dal.create({
      businessId,
      name: data.name,
      key: data.key,
      description: data.description || null,
      isSystemRole: false
    });

    if (data.permissionKeys && data.permissionKeys.length) {
      const perms = await db.Permission.findAll({ where: { key: data.permissionKeys } });
      await role.setPermissions(perms);
    }
    return role;
  }

  list(businessId?: string) {
    const where: any = { deletedAt: null };
    if (businessId) {
      where.businessId = businessId;
    }
    return this.dal.findAll(where, { order: [["createdAt", "DESC"]] });
  }

  getById(id: string) {
    return this.dal.findById(id, { include: [{ model: db.Permission }] });
  }

  async update(id: string, businessId: string, data: any) {
    const role = await db.Role.findOne({ where: { id, businessId } });
    if (!role) return null;
    if (role.isSystemRole) throw Object.assign(new Error("Cannot modify system role"), { statusCode: 403 });

    await role.update({
      name: data.name !== undefined ? data.name : role.name,
      key: data.key !== undefined ? data.key : role.key,
      description: data.description !== undefined ? data.description : role.description
    });

    if (data.permissionKeys) {
      const perms = await db.Permission.findAll({ where: { key: data.permissionKeys } });
      await role.setPermissions(perms);
    }

    return role;
  }

  async softDelete(id: string, businessId: string) {
    const role = await db.Role.findOne({ where: { id, businessId } });
    if (!role) return null;
    if (role.isSystemRole) throw Object.assign(new Error("Cannot delete system role"), { statusCode: 403 });
    await role.destroy();
    return true;
  }
}

