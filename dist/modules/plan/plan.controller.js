"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanController = void 0;
const plan_service_1 = require("./plan.service");
const auditLog_service_1 = require("../../services/auditLog.service");
const apiResponse_1 = require("../../utils/apiResponse");
class PlanController {
    constructor() {
        this.service = new plan_service_1.PlanService();
        this.list = async (_req, res) => {
            const plans = await this.service.list();
            return (0, apiResponse_1.ok)(res, { plans }, "Plans");
        };
        this.get = async (req, res, next) => {
            const plan = await this.service.getById(req.params.id);
            if (!plan)
                return next({ statusCode: 404, message: 'Not found' });
            return (0, apiResponse_1.ok)(res, { plan }, "Plan");
        };
        this.create = async (req, res) => {
            const plan = await this.service.create(req.body);
            await auditLog_service_1.AuditLogService.log('CREATE', 'plan', plan.id, null, plan, req);
            return (0, apiResponse_1.ok)(res, { plan }, "Plan created", 201);
        };
        this.update = async (req, res, next) => {
            const beforeData = await this.service.getById(req.params.id);
            const plan = await this.service.update(req.params.id, req.body);
            if (!plan)
                return next({ statusCode: 404, message: 'Not found' });
            await auditLog_service_1.AuditLogService.log('UPDATE', 'plan', plan.id, beforeData, plan, req);
            return (0, apiResponse_1.ok)(res, { plan }, "Plan updated");
        };
        this.remove = async (req, res, next) => {
            const beforeData = await this.service.getById(req.params.id);
            const deleted = await this.service.remove(req.params.id);
            if (!deleted)
                return next({ statusCode: 404, message: "Not found" });
            await auditLog_service_1.AuditLogService.log("DELETE", "plan", req.params.id, beforeData, null, req);
            return (0, apiResponse_1.ok)(res, { ok: true }, "Plan deleted");
        };
    }
}
exports.PlanController = PlanController;
