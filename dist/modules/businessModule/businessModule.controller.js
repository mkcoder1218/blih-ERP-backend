"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessModuleController = void 0;
const businessModule_service_1 = require("./businessModule.service");
const auditLog_service_1 = require("../../services/auditLog.service");
class BusinessModuleController {
    constructor() {
        this.service = new businessModule_service_1.BusinessModuleService();
        this.list = async (req, res) => {
            // If PLATFORM_SUPER_ADMIN and passed ?businessId=..., use that. Else use req.user.businessId.
            let businessId = req.user.businessId;
            if (req.user.isPlatformSuperAdmin && req.query.businessId)
                businessId = req.query.businessId;
            res.json({ modules: await this.service.list(businessId) });
        };
        this.get = async (req, res, next) => {
            let businessId = req.user.businessId;
            if (req.user.isPlatformSuperAdmin && req.query.businessId)
                businessId = req.query.businessId;
            const mod = await this.service.getById(req.params.id, businessId);
            if (!mod)
                return next({ statusCode: 404, message: 'Not found' });
            res.json({ module: mod });
        };
        this.update = async (req, res, next) => {
            // Only PLATFORM_SUPER_ADMIN can update. Business Admin cannot update status directly via this API.
            let businessId = req.user.businessId;
            if (req.user.isPlatformSuperAdmin && req.body.businessId)
                businessId = req.body.businessId;
            // Safety: ensure it genuinely belongs to that business
            const beforeData = await this.service.getById(req.params.id, businessId);
            if (!beforeData)
                return next({ statusCode: 404, message: 'Not found' });
            const mod = await this.service.update(req.params.id, businessId, req.body);
            await auditLog_service_1.AuditLogService.log('UPDATE', 'businessModule', mod.id, beforeData, mod, req);
            res.json({ module: mod });
        };
    }
}
exports.BusinessModuleController = BusinessModuleController;
