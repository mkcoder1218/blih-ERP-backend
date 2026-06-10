
import { db } from '../../models';

export class SettingsService {

  async initializeDefaults(businessId: string, companyName: string = "My Business") {
    // Upsert Branding
    await db.BusinessBranding.upsert({ businessId, companyName });
    // Upsert Localization
    await db.BusinessLocalization.upsert({ businessId });
    // Set default settings safely (no duplicates)
    const defaultSettings = [
      { businessId, key: 'allow_public_registration', value: false, category: 'security', isPublic: true },
      { businessId, key: 'enforce_2fa',               value: false, category: 'security', isPublic: false },
    ];
    for (const s of defaultSettings) {
      const existing = await db.BusinessSetting.findOne({ where: { businessId: s.businessId, key: s.key } });
      if (!existing) await db.BusinessSetting.create(s);
      // Don't overwrite — only seed if absent
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

    // Use findOne + update/create pattern to avoid duplicate rows.
    // Sequelize upsert without a unique index just inserts every time.
    const existing = await db.BusinessSetting.findOne({ where: { businessId, key } });
    if (existing) {
      await existing.update({
        value,
        ...(category  !== undefined ? { category }  : {}),
        ...(isPublic  !== undefined ? { isPublic }  : {}),
      });
      return existing;
    }
    return db.BusinessSetting.create({ businessId, key, value, category, isPublic });
  }

  async listSettings(businessId: string) {
    return db.BusinessSetting.findAll({ where: { businessId } });
  }

  async deleteSetting(businessId: string, key: string) {
    return db.BusinessSetting.destroy({ where: { businessId, key } });
  }
}
