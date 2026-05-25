"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowController = void 0;
const workflow_service_1 = require("./workflow.service");
const auditLog_service_1 = require("../../services/auditLog.service");
class WorkflowController {
    constructor() {
        this.service = new workflow_service_1.WorkflowService();
        this.list = async (req, res) => {
            const businessId = this.deriveBusinessId(req);
            const search = req.query.search || "";
            const page = parseInt(req.query.page) || 1;
            const size = parseInt(req.query.size) || 20;
            res.json(await this.service.list(businessId, search, page, size));
        };
        this.get = async (req, res, next) => {
            const businessId = this.deriveBusinessId(req);
            const wf = await this.service.getById(req.params.id, businessId);
            if (!wf)
                return next({ statusCode: 404, message: 'Not found' });
            res.json({ workflow: wf });
        };
        this.create = async (req, res) => {
            const businessId = this.deriveBusinessId(req);
            const wf = await this.service.create(businessId, req.body);
            await auditLog_service_1.AuditLogService.log('CREATE', 'approval_workflow', wf.id, null, wf, req);
            res.status(201).json({ workflow: wf });
        };
        this.createStep = async (req, res) => {
            const businessId = this.deriveBusinessId(req);
            const step = await this.service.createStep(businessId, req.body);
            await auditLog_service_1.AuditLogService.log('CREATE', 'approval_step', step.id, null, step, req);
            res.status(201).json({ step });
        };
    }
    deriveBusinessId(req) { return req.user.isPlatformSuperAdmin && req.query.businessId ? req.query.businessId : req.user.businessId; }
}
exports.WorkflowController = WorkflowController;
