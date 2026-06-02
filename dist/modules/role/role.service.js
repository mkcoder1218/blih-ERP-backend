"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleService = void 0;
const role_dal_1 = require("./role.dal");
const models_1 = require("../../models");
const Role_1 = require("../../models/Role");
const sequelize_1 = require("sequelize");
class RoleService {
    constructor() {
        this.dal = new role_dal_1.RoleDAL();
    }
    async create(businessId, data) {
        const role = await this.dal.create({
            businessId,
            name: data.name,
            key: data.key,
            description: data.description || null,
            domain: data.domain || null,
            isSystemRole: false
        });
        if (data.permissionKeys && data.permissionKeys.length) {
            const perms = await models_1.db.Permission.findAll({ where: { key: data.permissionKeys } });
            await role.setPermissions(perms);
        }
        return role;
    }
    list(businessId) {
        const where = { deletedAt: null };
        if (businessId) {
            where.businessId = businessId;
        }
        return this.dal.findAll(where, { order: [["createdAt", "DESC"]] });
    }
    /**
     * Returns only the roles the caller is allowed to manage based on their domain.
     * BUSINESS_ADMIN / PLATFORM_SUPER_ADMIN → all roles for the business.
     * Any other role key → only roles whose `domain` matches the caller's domain.
     */
    async listForCaller(businessId, callerRoleKeys) {
        // Check if caller has unrestricted access
        const isAdmin = callerRoleKeys.some(k => Role_1.ROLE_DOMAIN_MAP[k] === "*");
        if (isAdmin) {
            return this.list(businessId);
        }
        // Collect all domains the caller owns
        const ownedDomains = callerRoleKeys
            .map(k => Role_1.ROLE_DOMAIN_MAP[k])
            .filter(Boolean);
        if (ownedDomains.length === 0) {
            return []; // no domain ownership → no roles to manage
        }
        const where = {
            businessId,
            deletedAt: null,
            domain: { [sequelize_1.Op.in]: ownedDomains },
        };
        return this.dal.findAll(where, { order: [["createdAt", "DESC"]] });
    }
    getById(id) {
        return this.dal.findById(id, { include: [{ model: models_1.db.Permission }] });
    }
    async update(id, businessId, data, callerRoleKeys) {
        const role = await models_1.db.Role.findOne({ where: { id, businessId } });
        if (!role)
            return null;
        if (role.isSystemRole)
            throw Object.assign(new Error("Cannot modify system role"), { statusCode: 403 });
        // Domain check: non-admins can only update roles in their domain
        if (callerRoleKeys) {
            const isAdmin = callerRoleKeys.some(k => Role_1.ROLE_DOMAIN_MAP[k] === "*");
            if (!isAdmin) {
                const ownedDomains = callerRoleKeys.map(k => Role_1.ROLE_DOMAIN_MAP[k]).filter(Boolean);
                if (role.domain && !ownedDomains.includes(role.domain)) {
                    throw Object.assign(new Error("You can only update roles in your domain"), { statusCode: 403 });
                }
            }
        }
        await role.update({
            name: data.name !== undefined ? data.name : role.name,
            key: data.key !== undefined ? data.key : role.key,
            description: data.description !== undefined ? data.description : role.description,
            domain: data.domain !== undefined ? data.domain : role.domain,
        });
        if (data.permissionKeys) {
            const perms = await models_1.db.Permission.findAll({ where: { key: data.permissionKeys } });
            await role.setPermissions(perms);
        }
        return role;
    }
    async softDelete(id, businessId, callerRoleKeys) {
        const role = await models_1.db.Role.findOne({ where: { id, businessId } });
        if (!role)
            return null;
        if (role.isSystemRole)
            throw Object.assign(new Error("Cannot delete system role"), { statusCode: 403 });
        // Domain check
        if (callerRoleKeys) {
            const isAdmin = callerRoleKeys.some(k => Role_1.ROLE_DOMAIN_MAP[k] === "*");
            if (!isAdmin) {
                const ownedDomains = callerRoleKeys.map(k => Role_1.ROLE_DOMAIN_MAP[k]).filter(Boolean);
                if (role.domain && !ownedDomains.includes(role.domain)) {
                    throw Object.assign(new Error("You can only delete roles in your domain"), { statusCode: 403 });
                }
            }
        }
        await role.destroy();
        return true;
    }
}
exports.RoleService = RoleService;
