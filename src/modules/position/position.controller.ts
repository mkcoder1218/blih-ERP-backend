
import type { Request, Response, NextFunction } from 'express';
import { PositionService } from './position.service';
import { AuditLogService } from '../../services/auditLog.service';
export class PositionController {
  private service = new PositionService();
  
  private deriveBusinessId(req: Request) {
    return req.user!.isPlatformSuperAdmin && req.query.businessId
      ? req.query.businessId as string
      : req.user!.businessId;
  }

  list = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const search = (req.query.search as string) || "";
    const departmentId = req.query.departmentId as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;

    res.json(await this.service.list(businessId, search, page, size, departmentId));
  };
  
  get = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const pos = await this.service.getById(req.params.id, businessId);
    if (!pos) return next({ statusCode: 404, message: 'Not found' });
    res.json({ position: pos });
  };

  create = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const pos = await this.service.create(businessId, req.body);
    await AuditLogService.log('CREATE', 'position', pos.id, null, pos, req);
    res.status(201).json({ position: pos });
  };
  
  update = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const beforeData = await this.service.getById(req.params.id, businessId);
    const pos = await this.service.update(req.params.id, businessId, req.body);
    if (!pos) return next({ statusCode: 404, message: 'Not found' });
    await AuditLogService.log('UPDATE', 'position', pos.id, beforeData, pos, req);
    res.json({ position: pos });
  };
  
  remove = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const beforeData = await this.service.getById(req.params.id, businessId);
    const ok = await this.service.softDelete(req.params.id, businessId);
    if (!ok) return next({ statusCode: 404, message: 'Not found' });
    await AuditLogService.log('DELETE', 'position', req.params.id, beforeData, null, req);
    res.json({ ok: true });
  };
}
