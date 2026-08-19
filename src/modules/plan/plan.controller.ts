
import type { Request, Response, NextFunction } from 'express';
import { PlanService } from './plan.service';
import { AuditLogService } from '../../services/auditLog.service';
import { ok } from "../../utils/apiResponse";
export class PlanController {
  private service = new PlanService();
  list = async (_req: Request, res: Response) => {
    const plans = await this.service.list();
    return ok(res, { plans }, "Plans");
  };
  get = async (req: Request, res: Response, next: NextFunction) => {
    const plan = await this.service.getById(req.params.id);
    if (!plan) return next({ statusCode: 404, message: 'Not found' });
    return ok(res, { plan }, "Plan");
  };
  create = async (req: Request, res: Response) => {
    const plan = await this.service.create(req.body);
    await AuditLogService.log('CREATE', 'plan', plan.id, null, plan, req);
    return ok(res, { plan }, "Plan created", 201);
  };
  update = async (req: Request, res: Response, next: NextFunction) => {
    const beforeData = await this.service.getById(req.params.id);
    const plan = await this.service.update(req.params.id, req.body);
    if (!plan) return next({ statusCode: 404, message: 'Not found' });
    await AuditLogService.log('UPDATE', 'plan', plan.id, beforeData, plan, req);
    return ok(res, { plan }, "Plan updated");
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    const beforeData = await this.service.getById(req.params.id);
    const deleted = await this.service.remove(req.params.id);
    if (!deleted) return next({ statusCode: 404, message: "Not found" });
    await AuditLogService.log("DELETE", "plan", req.params.id, beforeData, null, req);
    return ok(res, { ok: true }, "Plan deleted");
  };
}
