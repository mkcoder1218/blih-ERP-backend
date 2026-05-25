"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreferenceService = void 0;
const preference_dal_1 = require("./preference.dal");
class PreferenceService {
    constructor() {
        this.dal = new preference_dal_1.PreferenceDAL();
    }
    listMine(businessId, userId) { return this.dal.findForUser(businessId, userId); }
    updateMine(businessId, userId, data) { return this.dal.upsert({ ...data, businessId, userId }); }
}
exports.PreferenceService = PreferenceService;
