"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileDAL = void 0;
const models_1 = require("../../models");
class ProfileDAL {
    findAll(query, offset, limit) {
        return models_1.db.BusinessUserProfile.findAndCountAll({ where: query, offset, limit, order: [['createdAt', 'DESC']] });
    }
    findById(id, businessId) { return models_1.db.BusinessUserProfile.findOne({ where: { id, businessId } }); }
    findByUserId(userId, businessId) { return models_1.db.BusinessUserProfile.findOne({ where: { userId, businessId } }); }
    create(data) { return models_1.db.BusinessUserProfile.create(data); }
    async update(id, businessId, data) {
        const prof = await models_1.db.BusinessUserProfile.findOne({ where: { id, businessId } });
        if (!prof)
            return null;
        return prof.update(data);
    }
    async softDelete(id, businessId) {
        const prof = await models_1.db.BusinessUserProfile.findOne({ where: { id, businessId } });
        if (!prof)
            return false;
        await prof.destroy();
        return true;
    }
}
exports.ProfileDAL = ProfileDAL;
