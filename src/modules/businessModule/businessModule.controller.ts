
import type { Request, Response, NextFunction } from 'express';
import { BusinessModuleService } from './businessModule.service';
import { AuditLogService } from '../../services/auditLog.service';
export class BusinessModuleController {
  private service = new BusinessModuleService();
  list = async (req: Request, res: Response) => {
    // If PLATFORM_SUPER_ADMIN and passed ?businessId=..., use that. Else use req.user.businessId.
    let businessId = req.user!.businessId;
    if (req.user!.isPlatformSuperAdmin && req.query.businessId) businessId = req.query.businessId as string;
    res.json({ modules: await this.service.list(businessId) });
  };
  get = async (req: Request, res: Response, next: NextFunction) => {
    let businessId = req.user!.businessId;
    if (req.user!.isPlatformSuperAdmin && req.query.businessId) businessId = req.query.businessId as string;
    const mod = await this.service.getById(req.params.id, businessId);
    if (!mod) return next({ statusCode: 404, message: 'Not found' });
    res.json({ module: mod });
  };
  update = async (req: Request, res: Response, next: NextFunction) => {
    // Only PLATFORM_SUPER_ADMIN can update. Business Admin cannot update status directly via this API.
    let businessId = req.user!.businessId;
    if (req.user!.isPlatformSuperAdmin && req.body.businessId) businessId = req.body.businessId;
    
    // Safety: ensure it genuinely belongs to that business
    const beforeData = await this.service.getById(req.params.id, businessId);
    if (!beforeData) return next({ statusCode: 404, message: 'Not found' });

    const mod = await this.service.update(req.params.id, businessId, req.body);
    await AuditLogService.log('UPDATE', 'businessModule', mod.id, beforeData, mod, req);
    res.json({ module: mod });
  };

  toggleModule = async (req: Request, res: Response) => {
    const { businessId, moduleKey, moduleName, status } = req.body;
    if (!businessId || !moduleKey) {
      return res.status(400).json({ message: "businessId and moduleKey are required" });
    }
    const { db } = await import('../../models');
    const [mod] = await db.BusinessModule.findOrCreate({
      where: { businessId, moduleKey },
      defaults: {
        businessId,
        moduleKey,
        moduleName: moduleName || moduleKey.toUpperCase(),
        status: status || 'active',
        enabledAt: new Date()
      }
    });
    if (status && mod.status !== status) {
      await mod.update({ status, enabledAt: status === 'active' ? new Date() : mod.enabledAt });
    }
    res.json({ module: mod });
  };
}
