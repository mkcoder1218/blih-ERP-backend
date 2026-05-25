"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmissionController = void 0;
const submission_service_1 = require("./submission.service");
const auditLog_service_1 = require("../../services/auditLog.service");
class SubmissionController {
    constructor() {
        this.service = new submission_service_1.SubmissionService();
        this.listMine = async (req, res) => {
            const page = parseInt(req.query.page) || 1;
            const size = parseInt(req.query.size) || 20;
            const statusFilter = req.query.status || "";
            res.json(await this.service.list(req.user.businessId, req.user.id, true, statusFilter, page, size));
        };
        this.get = async (req, res, next) => {
            const sub = await this.service.getById(req.params.id, req.user.businessId);
            if (!sub)
                return next({ statusCode: 404, message: 'Not found' });
            res.json({ submission: sub });
        };
        this.create = async (req, res, next) => {
            try {
                const sub = await this.service.submit(req.user.businessId, req.user.id, req.body);
                await auditLog_service_1.AuditLogService.log('SUBMIT_FORM', 'form_submission', sub.id, null, sub, req);
                res.status(201).json({ submission: sub });
            }
            catch (err) {
                next({ statusCode: 400, message: err.message });
            }
        };
    }
}
exports.SubmissionController = SubmissionController;
