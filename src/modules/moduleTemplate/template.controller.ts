
import type { Request, Response, NextFunction } from 'express';
import { TemplateService } from './template.service';
import { AuditLogService } from '../../services/auditLog.service';
export class TemplateController {
  private service = new TemplateService();

  list = async (req: Request, res: Response) => {
    res.json({ templates: await this.service.listAll() });
  };
  
  apply = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { moduleKey, targetBusinessId } = req.body;
      const businessId = req.user!.isPlatformSuperAdmin && targetBusinessId ? targetBusinessId : req.user!.businessId;
      
      await this.service.applyTemplate(businessId, moduleKey, false);
      
      await AuditLogService.log('APPLY_TEMPLATE', 'module_template', moduleKey, null, { businessId }, req);
      res.json({ ok: true, message: `Template ${moduleKey} applied successfully.` });
    } catch (err: any) { next({ statusCode: 400, message: err.message }); }
  };

  reapply = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { moduleKey, targetBusinessId } = req.body;
      const businessId = req.user!.isPlatformSuperAdmin && targetBusinessId ? targetBusinessId : req.user!.businessId;
      
      await this.service.applyTemplate(businessId, moduleKey, true);
      
      await AuditLogService.log('REAPPLY_TEMPLATE', 'module_template', moduleKey, null, { businessId }, req);
      res.json({ ok: true, message: `Template ${moduleKey} reapplied successfully.` });
    } catch (err: any) { next({ statusCode: 400, message: err.message }); }
  };
}
