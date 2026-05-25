"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ViewService = void 0;
const view_dal_1 = require("./view.dal");
class ViewService {
    constructor() {
        this.dal = new view_dal_1.ViewDAL();
    }
    listMine(businessId, userId, page, size) {
        return this.dal.findAll({ businessId, userId }, (page - 1) * size, size);
    }
    create(businessId, userId, data) { return this.dal.create({ ...data, businessId, userId }); }
    deleteItem(id, businessId) { return this.dal.deleteItem(id, businessId); }
}
exports.ViewService = ViewService;
