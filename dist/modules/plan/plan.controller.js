"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanController = void 0;
const plan_service_1 = require("./plan.service");
const auditLog_service_1 = require("../../services/auditLog.service");
class PlanController {
    constructor() {
        this.service = new plan_service_1.PlanService();
        this.list = async (req, res) => res.json({ plans: await this.service.list() });
        this.get = async (req, res, next) => {
            const plan = await this.service.getById(req.params.id);
            if (!plan)
                return next({ statusCode: 404, message: 'Not found' });
            res.json({ plan });
        };
        this.create = async (req, res) => {
            const plan = await this.service.create(req.body);
            await auditLog_service_1.AuditLogService.log('CREATE', 'plan', plan.id, null, plan, req);
            res.status(201).json({ plan });
        };
        this.update = async (req, res, next) => {
            const beforeData = await this.service.getById(req.params.id);
            const plan = await this.service.update(req.params.id, req.body);
            if (!plan)
                return next({ statusCode: 404, message: 'Not found' });
            await auditLog_service_1.AuditLogService.log('UPDATE', 'plan', plan.id, beforeData, plan, req);
            res.json({ plan });
        };
    }
}
exports.PlanController = PlanController;
