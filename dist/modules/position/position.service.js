"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PositionService = void 0;
const position_dal_1 = require("./position.dal");
const sequelize_1 = require("sequelize");
class PositionService {
    constructor() {
        this.dal = new position_dal_1.PositionDAL();
    }
    list(businessId, search, page, size, departmentId) {
        const offset = (page - 1) * size;
        const query = { businessId };
        if (search)
            query.title = { [sequelize_1.Op.iLike]: `%${search}%` };
        if (departmentId)
            query.departmentId = departmentId;
        return this.dal.findAll(query, offset, size);
    }
    getById(id, businessId) { return this.dal.findById(id, businessId); }
    create(businessId, data) {
        const key = data.key || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        return this.dal.create({ ...data, key, businessId });
    }
    update(id, businessId, data) { return this.dal.update(id, businessId, data); }
    softDelete(id, businessId) { return this.dal.softDelete(id, businessId); }
}
exports.PositionService = PositionService;
