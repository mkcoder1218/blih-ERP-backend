
import type { Request, Response, NextFunction } from 'express';
import { SubmissionService } from './submission.service';
import { AuditLogService } from '../../services/auditLog.service';
export class SubmissionController {
  private service = new SubmissionService();

  listMine = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    const statusFilter = req.query.status as string || "";
    res.json(await this.service.list(req.user!.businessId, req.user!.id, true, statusFilter, page, size));
  };
  
  get = async (req: Request, res: Response, next: NextFunction) => {
    const sub = await this.service.getById(req.params.id, req.user!.businessId);
    if (!sub) return next({ statusCode: 404, message: 'Not found' });
    res.json({ submission: sub });
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sub = await this.service.submit(req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log('SUBMIT_FORM', 'form_submission', sub.id, null, sub, req);
      res.status(201).json({ submission: sub });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };
}
