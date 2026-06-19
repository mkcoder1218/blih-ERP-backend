"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsService = void 0;
const models_1 = require("../../models");
class SettingsService {
    async initializeDefaults(businessId, companyName = "My Business") {
        // Upsert Branding
        await models_1.db.BusinessBranding.upsert({ businessId, companyName });
        // Upsert Localization
        await models_1.db.BusinessLocalization.upsert({ businessId });
        // Set default settings safely (no duplicates)
        const defaultSettings = [
            { businessId, key: 'allow_public_registration', value: false, category: 'security', isPublic: true },
            { businessId, key: 'enforce_2fa', value: false, category: 'security', isPublic: false },
        ];
        for (const s of defaultSettings) {
            const existing = await models_1.db.BusinessSetting.findOne({ where: { businessId: s.businessId, key: s.key } });
            if (!existing)
                await models_1.db.BusinessSetting.create(s);
            // Don't overwrite — only seed if absent
        }
    }
    async getPublicConfiguration(businessId) {
        const branding = await models_1.db.BusinessBranding.findOne({ where: { businessId } });
        const localization = await models_1.db.BusinessLocalization.findOne({ where: { businessId } });
        const settingsList = await models_1.db.BusinessSetting.findAll({ where: { businessId, isPublic: true } });
        // Convert array to object map
        let settings = {};
        settingsList.forEach((s) => { settings[s.key] = s.value; });
        return { branding, localization, settings };
    }
    async updateBranding(businessId, data) {
        const [branding] = await models_1.db.BusinessBranding.upsert({ ...data, businessId });
        return branding;
    }
    async updateLocalization(businessId, data) {
        const [localization] = await models_1.db.BusinessLocalization.upsert({ ...data, businessId });
        return localization;
    }
    async setBusinessSetting(businessId, key, value, category, isPublic) {
        // Guards against overriding subscription or module statuses via generic settings
        const restrictedKeys = ['plan', 'subscription', 'modules', 'features'];
        if (restrictedKeys.includes(key.toLowerCase())) {
            throw new Error("Cannot modify protected system capabilities through generic settings.");
        }
        // Use findOne + update/create pattern to avoid duplicate rows.
        // Sequelize upsert without a unique index just inserts every time.
        const existing = await models_1.db.BusinessSetting.findOne({ where: { businessId, key } });
        if (existing) {
            await existing.update({
                value,
                ...(category !== undefined ? { category } : {}),
                ...(isPublic !== undefined ? { isPublic } : {}),
            });
            return existing;
        }
        return models_1.db.BusinessSetting.create({ businessId, key, value, category, isPublic });
    }
    async listSettings(businessId) {
        return models_1.db.BusinessSetting.findAll({ where: { businessId } });
    }
    async deleteSetting(businessId, key) {
        return models_1.db.BusinessSetting.destroy({ where: { businessId, key } });
    }
}
exports.SettingsService = SettingsService;
