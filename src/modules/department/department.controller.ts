
import type { Request, Response, NextFunction } from 'express';
import { DepartmentService } from './department.service';
import { AuditLogService } from '../../services/auditLog.service';
export class DepartmentController {
  private service = new DepartmentService();
  
  private deriveBusinessId(req: Request) {
    return req.user!.isPlatformSuperAdmin && req.query.businessId
      ? req.query.businessId as string
      : req.user!.businessId;
  }

  list = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const search = (req.query.search as string) || "";
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;

    // Head can view own dept - simplified to assume they can view the directory of departments to run standard ERP.
    // Tenant isolation strictly blocks out-of-tenant data. 

    res.json(await this.service.list(businessId, search, page, size));
  };
  
  get = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const dep = await this.service.getById(req.params.id, businessId);
    if (!dep) return next({ statusCode: 404, message: 'Not found' });
    res.json({ department: dep });
  };

  create = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const dep = await this.service.create(businessId, req.body);
    await AuditLogService.log('CREATE', 'department', dep.id, null, dep, req);
    res.status(201).json({ department: dep });
  };
  
  update = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const beforeData = await this.service.getById(req.params.id, businessId);
    const dep = await this.service.update(req.params.id, businessId, req.body);
    if (!dep) return next({ statusCode: 404, message: 'Not found' });
    await AuditLogService.log('UPDATE', 'department', dep.id, beforeData, dep, req);
    res.json({ department: dep });
  };
  
  remove = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const beforeData = await this.service.getById(req.params.id, businessId);
    const ok = await this.service.softDelete(req.params.id, businessId);
    if (!ok) return next({ statusCode: 404, message: 'Not found' });
    await AuditLogService.log('DELETE', 'department', req.params.id, beforeData, null, req);
    res.json({ ok: true });
  };
}
