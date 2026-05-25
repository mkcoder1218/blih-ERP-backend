const fs = require('fs');
const path = require('path');

const src = path.join(process.cwd(), 'src');
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const modelsPath = path.join(src, 'models');

// -- BusinessSetting --
fs.writeFileSync(path.join(modelsPath, 'BusinessSetting.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type BusinessSettingModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): BusinessSettingModel => {
  const BusinessSetting = sequelize.define("BusinessSetting", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    key: { type: dataTypes.STRING(100), allowNull: false },
    value: { type: dataTypes.JSONB, allowNull: false },
    category: { type: dataTypes.STRING(50), defaultValue: "general" },
    isPublic: { type: dataTypes.BOOLEAN, defaultValue: false }
  }, { tableName: "business_settings", timestamps: true, paranoid: true }) as BusinessSettingModel;

  BusinessSetting.associate = (models: any) => {
    models.BusinessSetting.belongsTo(models.Business, { foreignKey: "businessId" });
  };
  return BusinessSetting;
};
`);

// -- BusinessBranding --
fs.writeFileSync(path.join(modelsPath, 'BusinessBranding.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type BusinessBrandingModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): BusinessBrandingModel => {
  const BusinessBranding = sequelize.define("BusinessBranding", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false, unique: true },
    logoFileId: { type: dataTypes.UUID, allowNull: true },
    faviconFileId: { type: dataTypes.UUID, allowNull: true },
    primaryColor: { type: dataTypes.STRING(20), defaultValue: "#000000" },
    secondaryColor: { type: dataTypes.STRING(20), defaultValue: "#ffffff" },
    accentColor: { type: dataTypes.STRING(20), defaultValue: "#3b82f6" },
    companyName: { type: dataTypes.STRING(255), allowNull: false },
    tagline: { type: dataTypes.STRING(255), allowNull: true },
    customDomain: { type: dataTypes.STRING(255), allowNull: true },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "business_branding", timestamps: true, paranoid: true }) as BusinessBrandingModel;

  BusinessBranding.associate = (models: any) => {
    models.BusinessBranding.belongsTo(models.Business, { foreignKey: "businessId" });
  };
  return BusinessBranding;
};
`);

// -- BusinessLocalization --
fs.writeFileSync(path.join(modelsPath, 'BusinessLocalization.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type BusinessLocalizationModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): BusinessLocalizationModel => {
  const BusinessLocalization = sequelize.define("BusinessLocalization", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false, unique: true },
    timezone: { type: dataTypes.STRING(100), defaultValue: "UTC" },
    currency: { type: dataTypes.STRING(10), defaultValue: "USD" },
    language: { type: dataTypes.STRING(20), defaultValue: "en" },
    dateFormat: { type: dataTypes.STRING(20), defaultValue: "YYYY-MM-DD" },
    timeFormat: { type: dataTypes.STRING(20), defaultValue: "24h" },
    fiscalYearStartMonth: { type: dataTypes.INTEGER, defaultValue: 1 },
    taxSettings: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "business_localizations", timestamps: true, paranoid: true }) as BusinessLocalizationModel;

  BusinessLocalization.associate = (models: any) => {
    models.BusinessLocalization.belongsTo(models.Business, { foreignKey: "businessId" });
  };
  return BusinessLocalization;
};
`);

ensureDir(path.join(src, 'modules', 'settings'));

// -- Service --
fs.writeFileSync(path.join(src, 'modules', 'settings', 'settings.service.ts'), `
import { db } from '../../models';

export class SettingsService {

  async initializeDefaults(businessId: string, companyName: string = "My Business") {
    // Upsert Branding
    await db.BusinessBranding.upsert({ businessId, companyName });
    // Upsert Localization
    await db.BusinessLocalization.upsert({ businessId });
    // Upsert default settings
    const defaultSettings = [
      { businessId, key: 'allow_public_registration', value: false, category: 'security', isPublic: true },
      { businessId, key: 'enforce_2fa', value: false, category: 'security', isPublic: false }
    ];
    for(const setting of defaultSettings) {
       await db.BusinessSetting.upsert(setting);
    }
  }

  async getPublicConfiguration(businessId: string) {
    const branding = await db.BusinessBranding.findOne({ where: { businessId } });
    const localization = await db.BusinessLocalization.findOne({ where: { businessId } });
    const settingsList = await db.BusinessSetting.findAll({ where: { businessId, isPublic: true } });
    
    // Convert array to object map
    let settings = {};
    settingsList.forEach((s: any) => { (settings as any)[s.key] = s.value; });

    return { branding, localization, settings };
  }

  async updateBranding(businessId: string, data: any) {
    const [branding] = await db.BusinessBranding.upsert({ ...data, businessId });
    return branding;
  }

  async updateLocalization(businessId: string, data: any) {
    const [localization] = await db.BusinessLocalization.upsert({ ...data, businessId });
    return localization;
  }

  async setBusinessSetting(businessId: string, key: string, value: any, category?: string, isPublic?: boolean) {
    // Guards against overriding subscription or module statuses via generic settings
    const restrictedKeys = ['plan', 'subscription', 'modules', 'features'];
    if (restrictedKeys.includes(key.toLowerCase())) {
        throw new Error("Cannot modify protected system capabilities through generic settings.");
    }
    const [setting] = await db.BusinessSetting.upsert({ businessId, key, value, category, isPublic });
    return setting;
  }

  async listSettings(businessId: string) {
    return db.BusinessSetting.findAll({ where: { businessId } });
  }

  async deleteSetting(businessId: string, key: string) {
    return db.BusinessSetting.destroy({ where: { businessId, key } });
  }
}
`);

// -- Controller --
fs.writeFileSync(path.join(src, 'modules', 'settings', 'settings.controller.ts'), `
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
`);

// -- Routes --
fs.writeFileSync(path.join(src, 'modules', 'settings', 'settings.routes.ts'), `
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { asyncHandler } from '../../utils/asyncHandler';
import { SettingsController } from './settings.controller';

const router = Router();
const controller = new SettingsController();

// Open/Public access mapping (still requires basic identity wrapper or explicit business ID passed)
// The getPublicConfiguration handles identity via user or query param, allowing unauthenticated UI to fetch brand config if passing query.
router.get('/public', asyncHandler(controller.getPublicConfiguration));

// Protected Management
router.patch('/branding', authRequired, requireRole('BUSINESS_ADMIN'), asyncHandler(controller.updateBranding));
router.patch('/localization', authRequired, requireRole('BUSINESS_ADMIN'), asyncHandler(controller.updateLocalization));

// Raw Settings
router.get('/', authRequired, requireRole('BUSINESS_ADMIN'), asyncHandler(controller.listSettings));
router.post('/', authRequired, requireRole('BUSINESS_ADMIN'), asyncHandler(controller.setSetting));
router.delete('/:key', authRequired, requireRole('BUSINESS_ADMIN'), asyncHandler(controller.deleteSetting));

// Utility init
router.post('/init', authRequired, requireRole('BUSINESS_ADMIN'), asyncHandler(controller.initializeDefaults));

export const settingsRoutes = router;
`);

console.log('Settings Scaffolding Created.');
