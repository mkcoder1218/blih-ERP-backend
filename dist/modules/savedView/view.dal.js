"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViewDAL = void 0;
const models_1 = require("../../models");
class ViewDAL {
    findAll(query, offset, limit) { return models_1.db.SavedView.findAndCountAll({ where: query, offset, limit }); }
    create(data) { return models_1.db.SavedView.create(data); }
    async deleteItem(id, businessId) {
        const v = await models_1.db.SavedView.findOne({ where: { id, businessId } });
        if (v) {
            await v.destroy();
            return true;
        }
        return false;
    }
}
exports.ViewDAL = ViewDAL;
