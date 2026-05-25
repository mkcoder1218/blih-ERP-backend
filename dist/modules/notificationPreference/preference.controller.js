"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreferenceController = void 0;
const preference_service_1 = require("./preference.service");
const auditLog_service_1 = require("../../services/auditLog.service");
class PreferenceController {
    constructor() {
        this.service = new preference_service_1.PreferenceService();
        this.listMine = async (req, res) => {
            res.json({ preferences: await this.service.listMine(req.user.businessId, req.user.id) });
        };
        this.updateMine = async (req, res, next) => {
            try {
                const pref = await this.service.updateMine(req.user.businessId, req.user.id, req.body);
                await auditLog_service_1.AuditLogService.log('UPDATE_NOTIFICATION_PREF', 'notification_preference', pref.id, null, pref, req);
                res.json({ preference: pref });
            }
            catch (err) {
                next({ statusCode: 400, message: err.message });
            }
        };
    }
}
exports.PreferenceController = PreferenceController;
