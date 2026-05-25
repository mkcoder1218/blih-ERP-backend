
import type { Request, Response, NextFunction } from 'express';
import { DefinitionService } from './definition.service';
import { AuditLogService } from '../../services/auditLog.service';
export class DefinitionController {
  private service = new DefinitionService();
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
    const def = await this.service.getById(req.params.id, businessId);
    if (!def) return next({ statusCode: 404, message: 'Not found' });
    res.json({ definition: def });
  };
  create = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const def = await this.service.create(businessId, req.body);
    await AuditLogService.log('CREATE', 'form_definition', def.id, null, def, req);
    res.status(201).json({ definition: def });
  };
  update = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const def = await this.service.update(req.params.id, businessId, req.body);
    if (!def) return next({ statusCode: 404, message: 'Not found' });
    res.json({ definition: def });
  };
  createField = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const field = await this.service.createField(businessId, req.body);
    await AuditLogService.log('CREATE', 'form_field', field.id, null, field, req);
    res.status(201).json({ field });
  };
  updateField = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const field = await this.service.updateField(req.params.id, businessId, req.body);
    if (!field) return next({ statusCode: 404, message: 'Not found' });
    res.json({ field });
  };
}
