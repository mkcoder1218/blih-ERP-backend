"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogDAL = void 0;
const models_1 = require("../../models");
class AuditLogDAL {
    findAll(query) { return models_1.db.AuditLog.findAll({ where: query, order: [['createdAt', 'DESC']] }); }
    findById(id) { return models_1.db.AuditLog.findByPk(id); }
}
exports.AuditLogDAL = AuditLogDAL;
