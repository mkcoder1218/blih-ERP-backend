"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WidgetService = void 0;
const widget_dal_1 = require("./widget.dal");
const sequelize_1 = require("sequelize");
class WidgetService {
    constructor() {
        this.dal = new widget_dal_1.WidgetDAL();
    }
    listMine(businessId, userId, page, size) {
        const offset = (page - 1) * size;
        return this.dal.findAll({ businessId, [sequelize_1.Op.or]: [{ ownerUserId: userId }, { visibility: 'business' }] }, offset, size);
    }
    getById(id, businessId) { return this.dal.findById(id, businessId); }
    create(businessId, userId, data) { return this.dal.create({ ...data, businessId, ownerUserId: userId }); }
    update(id, businessId, data) { return this.dal.update(id, businessId, data); }
}
exports.WidgetService = WidgetService;
