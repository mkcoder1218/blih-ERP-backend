"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WidgetDAL = void 0;
const models_1 = require("../../models");
class WidgetDAL {
    findAll(query, offset, limit) { return models_1.db.DashboardWidget.findAndCountAll({ where: query, offset, limit }); }
    findById(id, businessId) { return models_1.db.DashboardWidget.findOne({ where: { id, businessId } }); }
    create(data) { return models_1.db.DashboardWidget.create(data); }
    async update(id, businessId, data) {
        const w = await models_1.db.DashboardWidget.findOne({ where: { id, businessId } });
        if (w)
            return w.update(data);
        return null;
    }
}
exports.WidgetDAL = WidgetDAL;
