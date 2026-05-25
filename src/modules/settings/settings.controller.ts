
import type { Request, Response } from 'express';
import { SettingsService } from './settings.service';
import { AuditLogService } from '../../services/auditLog.service';

export class SettingsController {
  private service = new SettingsService();

  // Public/Client Accessible
  getPublicConfiguration = async (req: Request, res: Response) => {
    try {
      const bId = req.user?.businessId || (req as any).portalUser?.businessId || req.query.businessId as string;
      if (!bId) return res.status(400).json({ message: "Business ID required contextually." });
      const config = await this.service.getPublicConfiguration(bId);
      res.json(config);
    } catch(e: any) { res.status(500).json({ message: e.message }); }
  };

  // Internal Management
  updateBranding = async (req: Request, res: Response) => {
    try {
      const brand = await this.service.updateBranding(req.user!.businessId, req.body);
      await AuditLogService.log('UPDATE_BRANDING', 'business_branding', String(brand.id), null, req.body, req);
      res.json({ branding: brand });
    } catch(e: any) { res.status(400).json({ message: e.message }); }
  };

  updateLocalization = async (req: Request, res: Response) => {
    try {
      const loc = await this.service.updateLocalization(req.user!.businessId, req.body);
      await AuditLogService.log('UPDATE_LOCALIZATION', 'business_localization', String(loc.id), null, req.body, req);
      res.json({ localization: loc });
    } catch(e: any) { res.status(400).json({ message: e.message }); }
  };

  setSetting = async (req: Request, res: Response) => {
    try {
      const { key, value, category, isPublic } = req.body;
      const set = await this.service.setBusinessSetting(req.user!.businessId, key, value, category, isPublic);
      await AuditLogService.log('UPDATE_SETTING', 'business_setting', String(set.id), null, { key, value }, req);
      res.json({ setting: set });
    } catch(e: any) { res.status(400).json({ message: e.message }); }
  };

  listSettings = async (req: Request, res: Response) => {
    const list = await this.service.listSettings(req.user!.businessId);
    res.json({ settings: list });
  };

  deleteSetting = async (req: Request, res: Response) => {
    try {
      await this.service.deleteSetting(req.user!.businessId, req.params.key);
      await AuditLogService.log('DELETE_SETTING', 'business_setting', req.params.key, null, {}, req);
         res.status(204).send();
    } catch(e: any) { res.status(400).json({ message: e.message }); }
  };

  initializeDefaults = async (req: Request, res: Response) => {
    // Utility for manual initialization triggers via admin
    await this.service.initializeDefaults(req.user!.businessId, req.body.companyName);
    res.json({ message: "Default configurations initialized" });
  };
}
