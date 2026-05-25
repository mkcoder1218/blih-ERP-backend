"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsController = void 0;
const settings_service_1 = require("./settings.service");
const auditLog_service_1 = require("../../services/auditLog.service");
class SettingsController {
    constructor() {
        this.service = new settings_service_1.SettingsService();
        // Public/Client Accessible
        this.getPublicConfiguration = async (req, res) => {
            try {
                const bId = req.user?.businessId || req.portalUser?.businessId || req.query.businessId;
                if (!bId)
                    return res.status(400).json({ message: "Business ID required contextually." });
                const config = await this.service.getPublicConfiguration(bId);
                res.json(config);
            }
            catch (e) {
                res.status(500).json({ message: e.message });
            }
        };
        // Internal Management
        this.updateBranding = async (req, res) => {
            try {
                const brand = await this.service.updateBranding(req.user.businessId, req.body);
                await auditLog_service_1.AuditLogService.log('UPDATE_BRANDING', 'business_branding', String(brand.id), null, req.body, req);
                res.json({ branding: brand });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        this.updateLocalization = async (req, res) => {
            try {
                const loc = await this.service.updateLocalization(req.user.businessId, req.body);
                await auditLog_service_1.AuditLogService.log('UPDATE_LOCALIZATION', 'business_localization', String(loc.id), null, req.body, req);
                res.json({ localization: loc });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        this.setSetting = async (req, res) => {
            try {
                const { key, value, category, isPublic } = req.body;
                const set = await this.service.setBusinessSetting(req.user.businessId, key, value, category, isPublic);
                await auditLog_service_1.AuditLogService.log('UPDATE_SETTING', 'business_setting', String(set.id), null, { key, value }, req);
                res.json({ setting: set });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        this.listSettings = async (req, res) => {
            const list = await this.service.listSettings(req.user.businessId);
            res.json({ settings: list });
        };
        this.deleteSetting = async (req, res) => {
            try {
                await this.service.deleteSetting(req.user.businessId, req.params.key);
                await auditLog_service_1.AuditLogService.log('DELETE_SETTING', 'business_setting', req.params.key, null, {}, req);
                res.status(204).send();
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        this.initializeDefaults = async (req, res) => {
            // Utility for manual initialization triggers via admin
            await this.service.initializeDefaults(req.user.businessId, req.body.companyName);
            res.json({ message: "Default configurations initialized" });
        };
    }
}
exports.SettingsController = SettingsController;
