
import type { Request, Response, NextFunction } from 'express';
import { AttachmentService } from './attachment.service';
import { AuditLogService } from '../../services/auditLog.service';
export class AttachmentController {
  private service = new AttachmentService();
  private deriveBusinessId(req: Request) { return req.user!.isPlatformSuperAdmin && req.query.businessId ? req.query.businessId as string : req.user!.businessId; }

  list = async (req: Request, res: Response) => {
    const businessId = this.deriveBusinessId(req);
    const entityType = req.query.entityType as string || "";
    const entityId = req.query.entityId as string || "";
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;

    res.json(await this.service.list(businessId, entityType, entityId, page, size));
  };
  
  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = this.deriveBusinessId(req);
      const att = await this.service.create(businessId, req.body);
      await AuditLogService.log('ATTACH_FILE', req.body.entityType, req.body.entityId, null, att, req);
      res.status(201).json({ attachment: att });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = this.deriveBusinessId(req);
    const ok = await this.service.softDelete(req.params.id, businessId);
    if (!ok) return next({ statusCode: 404, message: 'Not found' });
    // Assuming we could fetch it prior to log, here simplifying
    await AuditLogService.log('DETACH_FILE', 'entity_attachment', req.params.id, null, null, req);
    res.json({ ok: true });
  };
}
