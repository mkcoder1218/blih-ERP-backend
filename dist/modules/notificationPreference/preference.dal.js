"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreferenceDAL = void 0;
const models_1 = require("../../models");
class PreferenceDAL {
    findForUser(businessId, userId) { return models_1.db.NotificationPreference.findAll({ where: { businessId, userId } }); }
    async upsert(data) {
        // Basic match
        const existing = await models_1.db.NotificationPreference.findOne({ where: { businessId: data.businessId, userId: data.userId, channel: data.channel, moduleKey: data.moduleKey, type: data.type } });
        if (existing)
            return existing.update(data);
        return models_1.db.NotificationPreference.create(data);
    }
}
exports.PreferenceDAL = PreferenceDAL;
