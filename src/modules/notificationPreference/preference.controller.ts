
import type { Request, Response, NextFunction } from 'express';
import { PreferenceService } from './preference.service';
import { AuditLogService } from '../../services/auditLog.service';
export class PreferenceController {
  private service = new PreferenceService();

  listMine = async (req: Request, res: Response) => {
    res.json({ preferences: await this.service.listMine(req.user!.businessId, req.user!.id) });
  };
  
  updateMine = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pref = await this.service.updateMine(req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log('UPDATE_NOTIFICATION_PREF', 'notification_preference', pref.id, null, pref, req);
      res.json({ preference: pref });
    } catch (err: any) { next({ statusCode: 400, message: err.message }); }
  };
}
