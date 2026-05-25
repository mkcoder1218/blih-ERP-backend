
import type { Request, Response, NextFunction } from 'express';
import { RequestService } from './request.service';
import { AuditLogService } from '../../services/auditLog.service';
export class RequestController {
  private service = new RequestService();

  listMine = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    res.json(await this.service.list(req.user!.businessId, req.user!.id, true, false, page, size));
  };
  
  get = async (req: Request, res: Response, next: NextFunction) => {
    const r = await this.service.getById(req.params.id, req.user!.businessId);
    if (!r) return next({ statusCode: 404, message: 'Not found' });
    res.json({ request: r });
  };

  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = await this.service.submit(req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log('SUBMIT_APPROVAL', 'approval_request', r.id, null, r, req);
      res.status(201).json({ request: r });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };

  act = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const r = await this.service.actOnRequest(req.params.id, req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log('ACTION_APPROVAL', 'approval_request', req.params.id, null, { action: req.body.action }, req);
      res.json({ request: r });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };
}
