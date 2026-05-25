
import type { Request, Response, NextFunction } from 'express';
import { WidgetService } from './widget.service';
import { AuditLogService } from '../../services/auditLog.service';
export class WidgetController {
  private service = new WidgetService();

  list = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    res.json(await this.service.listMine(req.user!.businessId, req.user!.id, page, size));
  };
  get = async (req: Request, res: Response, next: NextFunction) => {
    const doc = await this.service.getById(req.params.id, req.user!.businessId);
    if(!doc) return next({ statusCode: 404, message: 'Not found' });
    res.json({ widget: doc });
  };
  create = async (req: Request, res: Response) => {
    const doc = await this.service.create(req.user!.businessId, req.user!.id, req.body);
    await AuditLogService.log('CREATE_WIDGET', 'dashboard_widget', doc.id, null, doc, req);
    res.status(201).json({ widget: doc });
  };
  update = async (req: Request, res: Response, next: NextFunction) => {
    const doc = await this.service.update(req.params.id, req.user!.businessId, req.body);
    if(!doc) return next({ statusCode: 404, message: 'Not found' });
    res.json({ widget: doc });
  };
}
