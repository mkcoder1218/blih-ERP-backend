"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateController = void 0;
const template_service_1 = require("./template.service");
const auditLog_service_1 = require("../../services/auditLog.service");
class TemplateController {
    constructor() {
        this.service = new template_service_1.TemplateService();
        this.list = async (req, res) => {
            res.json({ templates: await this.service.listAll() });
        };
        this.apply = async (req, res, next) => {
            try {
                const { moduleKey, targetBusinessId } = req.body;
                const businessId = req.user.isPlatformSuperAdmin && targetBusinessId ? targetBusinessId : req.user.businessId;
                await this.service.applyTemplate(businessId, moduleKey, false);
                await auditLog_service_1.AuditLogService.log('APPLY_TEMPLATE', 'module_template', moduleKey, null, { businessId }, req);
                res.json({ ok: true, message: `Template ${moduleKey} applied successfully.` });
            }
            catch (err) {
                next({ statusCode: 400, message: err.message });
            }
        };
        this.reapply = async (req, res, next) => {
            try {
                const { moduleKey, targetBusinessId } = req.body;
                const businessId = req.user.isPlatformSuperAdmin && targetBusinessId ? targetBusinessId : req.user.businessId;
                await this.service.applyTemplate(businessId, moduleKey, true);
                await auditLog_service_1.AuditLogService.log('REAPPLY_TEMPLATE', 'module_template', moduleKey, null, { businessId }, req);
                res.json({ ok: true, message: `Template ${moduleKey} reapplied successfully.` });
            }
            catch (err) {
                next({ statusCode: 400, message: err.message });
            }
        };
    }
}
exports.TemplateController = TemplateController;
