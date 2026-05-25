
import type { Request, Response, NextFunction } from 'express';
import { AuditLogServiceRead } from './auditLog.service';
export class AuditLogController {
  private service = new AuditLogServiceRead();
  list = async (req: Request, res: Response) => {
    const businessId = req.user!.isPlatformSuperAdmin && !req.query.businessId ? undefined : (req.user!.isPlatformSuperAdmin ? (req.query.businessId as string) : req.user!.businessId);
    res.json({ logs: await this.service.list(businessId) });
  };
  get = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = req.user!.isPlatformSuperAdmin ? undefined : req.user!.businessId;
    const log = await this.service.getById(req.params.id, businessId);
    if (!log) return next({ statusCode: 404, message: 'Not found' });
    res.json({ log });
  };
}
