"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogController = void 0;
const auditLog_service_1 = require("./auditLog.service");
class AuditLogController {
    constructor() {
        this.service = new auditLog_service_1.AuditLogServiceRead();
        this.list = async (req, res) => {
            const businessId = req.user.isPlatformSuperAdmin && !req.query.businessId ? undefined : (req.user.isPlatformSuperAdmin ? req.query.businessId : req.user.businessId);
            res.json({ logs: await this.service.list(businessId) });
        };
        this.get = async (req, res, next) => {
            const businessId = req.user.isPlatformSuperAdmin ? undefined : req.user.businessId;
            const log = await this.service.getById(req.params.id, businessId);
            if (!log)
                return next({ statusCode: 404, message: 'Not found' });
            res.json({ log });
        };
    }
}
exports.AuditLogController = AuditLogController;
