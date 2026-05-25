
import type { Request, Response, NextFunction } from 'express';
import { ViewService } from './view.service';
import { AuditLogService } from '../../services/auditLog.service';
export class ViewController {
  private service = new ViewService();
  list = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    res.json(await this.service.listMine(req.user!.businessId, req.user!.id, page, size));
  };
  create = async (req: Request, res: Response) => {
    const doc = await this.service.create(req.user!.businessId, req.user!.id, req.body);
    await AuditLogService.log('CREATE_SAVED_VIEW', 'saved_view', doc.id, null, doc, req);
    res.status(201).json({ view: doc });
  };
  remove = async (req: Request, res: Response, next: NextFunction) => {
    const ok = await this.service.deleteItem(req.params.id, req.user!.businessId);
    if(!ok) return next({ statusCode: 404, message: 'Not found' });
    res.json({ ok: true });
  };
}
