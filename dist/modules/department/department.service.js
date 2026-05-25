"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepartmentService = void 0;
const department_dal_1 = require("./department.dal");
const sequelize_1 = require("sequelize");
class DepartmentService {
    constructor() {
        this.dal = new department_dal_1.DepartmentDAL();
    }
    list(businessId, search, page, size) {
        const offset = (page - 1) * size;
        const query = { businessId };
        if (search)
            query.name = { [sequelize_1.Op.iLike]: `%${search}%` };
        return this.dal.findAll(query, offset, size);
    }
    getById(id, businessId) { return this.dal.findById(id, businessId); }
    create(businessId, data) { return this.dal.create({ ...data, businessId }); }
    update(id, businessId, data) { return this.dal.update(id, businessId, data); }
    softDelete(id, businessId) { return this.dal.softDelete(id, businessId); }
}
exports.DepartmentService = DepartmentService;
