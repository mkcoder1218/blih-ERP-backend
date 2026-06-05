"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogController = void 0;
const auditLog_service_1 = require("./auditLog.service");
class AuditLogController {
    constructor() {
        this.service = new auditLog_service_1.AuditLogServiceRead();
        this.list = async (req, res) => {
            const isSuperAdmin = req.user.isPlatformSuperAdmin;
            // Super admin can query across all businesses or filter by one
            // Business admin is locked to their own businessId
            const businessId = isSuperAdmin
                ? req.query.businessId
                : req.user.businessId;
            const page = Math.max(1, parseInt(req.query.page) || 1);
            const size = Math.min(100, Math.max(1, parseInt(req.query.size) || 20));
            const { count, rows } = await this.service.listPaginated({
                businessId,
                userId: req.query.userId,
                action: req.query.action,
                entityType: req.query.entityType,
                category: req.query.category,
                search: req.query.search,
                dateFrom: req.query.dateFrom,
                dateTo: req.query.dateTo,
                page,
                size,
            });
            res.json({
                logs: rows,
                total: count,
                page,
                size,
                totalPages: Math.ceil(count / size),
            });
        };
        this.get = async (req, res, next) => {
            const log = await this.service.getById(req.params.id);
            if (!log)
                return next({ statusCode: 404, message: "Audit log not found" });
            // Non-super-admin can only read their own business logs
            if (!req.user.isPlatformSuperAdmin && log.businessId !== req.user.businessId) {
                return next({ statusCode: 403, message: "Forbidden" });
            }
            res.json({ log });
        };
    }
}
exports.AuditLogController = AuditLogController;
