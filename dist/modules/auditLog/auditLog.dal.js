"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogDAL = void 0;
const sequelize_1 = require("sequelize");
const models_1 = require("../../models");
class AuditLogDAL {
    async findPaginated(filters) {
        const { businessId, userId, action, entityType, category, search, dateFrom, dateTo, page = 1, size = 20, } = filters;
        const where = {};
        if (businessId)
            where.businessId = businessId;
        if (userId)
            where.userId = userId;
        if (action)
            where.action = action;
        if (entityType)
            where.entityType = entityType;
        if (category)
            where.category = category;
        if (dateFrom || dateTo) {
            where.createdAt = {};
            if (dateFrom)
                where.createdAt[sequelize_1.Op.gte] = new Date(dateFrom);
            if (dateTo) {
                const end = new Date(dateTo);
                end.setHours(23, 59, 59, 999);
                where.createdAt[sequelize_1.Op.lte] = end;
            }
        }
        if (search) {
            where[sequelize_1.Op.or] = [
                { entityType: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { action: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { entityId: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { ipAddress: { [sequelize_1.Op.iLike]: `%${search}%` } },
                { deviceInfo: { [sequelize_1.Op.iLike]: `%${search}%` } },
            ];
        }
        const offset = (page - 1) * size;
        return models_1.db.AuditLog.findAndCountAll({
            where,
            order: [["createdAt", "DESC"]],
            limit: size,
            offset,
            include: [
                {
                    model: models_1.db.User,
                    as: undefined,
                    attributes: ["id", "fullName", "email"],
                    required: false,
                },
                {
                    model: models_1.db.Business,
                    as: undefined,
                    attributes: ["id", "name", "slug"],
                    required: false,
                },
            ],
        });
    }
    findById(id) {
        return models_1.db.AuditLog.findByPk(id, {
            include: [
                {
                    model: models_1.db.User,
                    attributes: ["id", "fullName", "email"],
                    required: false,
                },
                {
                    model: models_1.db.Business,
                    attributes: ["id", "name", "slug"],
                    required: false,
                },
            ],
        });
    }
}
exports.AuditLogDAL = AuditLogDAL;
