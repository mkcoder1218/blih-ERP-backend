"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleService = void 0;
const role_dal_1 = require("./role.dal");
const models_1 = require("../../models");
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
            isSystemRole: false
        });
        if (data.permissionKeys && data.permissionKeys.length) {
            const perms = await models_1.db.Permission.findAll({ where: { key: data.permissionKeys } });
            await role.setPermissions(perms);
        }
        return role;
    }
    list(businessId) {
        return this.dal.findAll({ businessId }, { order: [["createdAt", "DESC"]] });
    }
    getById(id) {
        return this.dal.findById(id, { include: [{ model: models_1.db.Permission }] });
    }
    async update(id, businessId, data) {
        const role = await models_1.db.Role.findOne({ where: { id, businessId } });
        if (!role)
            return null;
        if (role.isSystemRole)
            throw Object.assign(new Error("Cannot modify system role"), { statusCode: 403 });
        await role.update({
            name: data.name !== undefined ? data.name : role.name,
            key: data.key !== undefined ? data.key : role.key,
            description: data.description !== undefined ? data.description : role.description
        });
        if (data.permissionKeys) {
            const perms = await models_1.db.Permission.findAll({ where: { key: data.permissionKeys } });
            await role.setPermissions(perms);
        }
        return role;
    }
    async softDelete(id, businessId) {
        const role = await models_1.db.Role.findOne({ where: { id, businessId } });
        if (!role)
            return null;
        if (role.isSystemRole)
            throw Object.assign(new Error("Cannot delete system role"), { statusCode: 403 });
        await role.destroy();
        return true;
    }
}
exports.RoleService = RoleService;
