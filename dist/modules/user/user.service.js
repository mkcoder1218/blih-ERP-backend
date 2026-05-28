"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const env_1 = require("../../config/env");
const models_1 = require("../../models");
const user_dal_1 = require("./user.dal");
const normalizeEmail_1 = require("../../utils/normalizeEmail");
class UserService {
    constructor() {
        this.dal = new user_dal_1.UserDAL();
    }
    list(businessId) {
        return this.dal.findAll({ businessId }, { attributes: { exclude: ["password"] }, order: [["createdAt", "DESC"]] });
    }
    getById(id, businessId) {
        return models_1.db.User.findOne({
            where: { id, businessId },
            attributes: { exclude: ["password"] },
            include: [{ model: models_1.db.Role }]
        });
    }
    async create(requester, data) {
        const businessId = requester.isPlatformSuperAdmin ? (data.businessId || requester.businessId) : requester.businessId;
        const hashed = await bcrypt_1.default.hash(data.password, env_1.env.bcryptSaltRounds);
        const user = await models_1.db.User.create({
            businessId,
            fullName: data.fullName,
            email: (0, normalizeEmail_1.normalizeEmail)(data.email),
            password: hashed,
            phone: data.phone || null,
            status: data.status || "active",
            isPlatformSuperAdmin: requester.isPlatformSuperAdmin ? Boolean(data.isPlatformSuperAdmin) : false
        });
        if (data.roleKeys && data.roleKeys.length) {
            const roles = await models_1.db.Role.findAll({ where: { key: data.roleKeys, businessId } });
            await user.setRoles(roles);
        }
        else {
            const businessAdmin = await models_1.db.Role.findOne({ where: { businessId: null, key: "BUSINESS_ADMIN" } });
            if (businessAdmin)
                await user.setRoles([businessAdmin]);
        }
        const safe = user.toJSON();
        delete safe.password;
        return safe;
    }
    async update(id, requester, data) {
        const where = requester.isPlatformSuperAdmin ? { id } : { id, businessId: requester.businessId };
        const user = await models_1.db.User.findOne({ where });
        if (!user)
            return null;
        const update = { ...data };
        if (update.email)
            update.email = (0, normalizeEmail_1.normalizeEmail)(update.email);
        if (update.password) {
            update.password = await bcrypt_1.default.hash(update.password, env_1.env.bcryptSaltRounds);
        }
        if (!requester.isPlatformSuperAdmin)
            delete update.isPlatformSuperAdmin;
        await user.update(update);
        if (data.roleKeys) {
            const businessId = user.businessId;
            const roles = await models_1.db.Role.findAll({ where: { key: data.roleKeys, businessId } });
            await user.setRoles(roles);
        }
        const safe = user.toJSON();
        delete safe.password;
        return safe;
    }
    async softDelete(id, requester) {
        const where = requester.isPlatformSuperAdmin ? { id } : { id, businessId: requester.businessId };
        const user = await models_1.db.User.findOne({ where });
        if (!user)
            return null;
        await user.destroy();
        return true;
    }
}
exports.UserService = UserService;
