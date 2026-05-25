
import type { Request, Response, NextFunction } from 'express';
import { WorkflowService } from './workflow.service';
import { AuditLogService } from '../../services/auditLog.service';
export class WorkflowController {
  private service = new WorkflowService();
  private deriveBusinessId(req: Request) { return req.user!.isPlatformSuperAdmin && req.query.businessId ? req.query.businessId as string : req.user!.businessId; }

  list = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const search = req.query.search as string || "";
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    res.json(await this.service.list(businessId, search, page, size));
  };
  get = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const wf = await this.service.getById(req.params.id, businessId);
    if (!wf) return next({ statusCode: 404, message: 'Not found' });
    res.json({ workflow: wf });
  };
  create = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const wf = await this.service.create(businessId, req.body);
    await AuditLogService.log('CREATE', 'approval_workflow', wf.id, null, wf, req);
    res.status(201).json({ workflow: wf });
  };
  createStep = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const step = await this.service.createStep(businessId, req.body);
    await AuditLogService.log('CREATE', 'approval_step', step.id, null, step, req);
    res.status(201).json({ step });
  };
}
