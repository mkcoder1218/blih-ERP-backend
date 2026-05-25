"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestController = void 0;
const request_service_1 = require("./request.service");
const auditLog_service_1 = require("../../services/auditLog.service");
class RequestController {
    constructor() {
        this.service = new request_service_1.RequestService();
        this.listMine = async (req, res) => {
            const page = parseInt(req.query.page) || 1;
            const size = parseInt(req.query.size) || 20;
            res.json(await this.service.list(req.user.businessId, req.user.id, true, false, page, size));
        };
        this.get = async (req, res, next) => {
            const r = await this.service.getById(req.params.id, req.user.businessId);
            if (!r)
                return next({ statusCode: 404, message: 'Not found' });
            res.json({ request: r });
        };
        this.submit = async (req, res, next) => {
            try {
                const r = await this.service.submit(req.user.businessId, req.user.id, req.body);
                await auditLog_service_1.AuditLogService.log('SUBMIT_APPROVAL', 'approval_request', r.id, null, r, req);
                res.status(201).json({ request: r });
            }
            catch (err) {
                next({ statusCode: 400, message: err.message });
            }
        };
        this.act = async (req, res, next) => {
            try {
                const r = await this.service.actOnRequest(req.params.id, req.user.businessId, req.user.id, req.body);
                await auditLog_service_1.AuditLogService.log('ACTION_APPROVAL', 'approval_request', req.params.id, null, { action: req.body.action }, req);
                res.json({ request: r });
            }
            catch (err) {
                next({ statusCode: 400, message: err.message });
            }
        };
    }
}
exports.RequestController = RequestController;
