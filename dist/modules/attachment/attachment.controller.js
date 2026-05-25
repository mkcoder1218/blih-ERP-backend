"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttachmentController = void 0;
const attachment_service_1 = require("./attachment.service");
const auditLog_service_1 = require("../../services/auditLog.service");
class AttachmentController {
    constructor() {
        this.service = new attachment_service_1.AttachmentService();
        this.list = async (req, res) => {
            const businessId = this.deriveBusinessId(req);
            const entityType = req.query.entityType || "";
            const entityId = req.query.entityId || "";
            const page = parseInt(req.query.page) || 1;
            const size = parseInt(req.query.size) || 20;
            res.json(await this.service.list(businessId, entityType, entityId, page, size));
        };
        this.create = async (req, res, next) => {
            try {
                const businessId = this.deriveBusinessId(req);
                const att = await this.service.create(businessId, req.body);
                await auditLog_service_1.AuditLogService.log('ATTACH_FILE', req.body.entityType, req.body.entityId, null, att, req);
                res.status(201).json({ attachment: att });
            }
            catch (err) {
                next({ statusCode: 400, message: err.message });
            }
        };
        this.remove = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const ok = await this.service.softDelete(req.params.id, businessId);
            if (!ok)
                return next({ statusCode: 404, message: 'Not found' });
            // Assuming we could fetch it prior to log, here simplifying
            await auditLog_service_1.AuditLogService.log('DETACH_FILE', 'entity_attachment', req.params.id, null, null, req);
            res.json({ ok: true });
        };
    }
    deriveBusinessId(req) { return req.user.isPlatformSuperAdmin && req.query.businessId ? req.query.businessId : req.user.businessId; }
}
exports.AttachmentController = AttachmentController;
