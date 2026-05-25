"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepartmentDAL = void 0;
const models_1 = require("../../models");
class DepartmentDAL {
    findAll(query, offset, limit) {
        return models_1.db.Department.findAndCountAll({ where: query, offset, limit, order: [['createdAt', 'DESC']] });
    }
    findById(id, businessId) { return models_1.db.Department.findOne({ where: { id, businessId } }); }
    create(data) { return models_1.db.Department.create(data); }
    async update(id, businessId, data) {
        const dep = await models_1.db.Department.findOne({ where: { id, businessId } });
        if (!dep)
            return null;
        return dep.update(data);
    }
    async softDelete(id, businessId) {
        const dep = await models_1.db.Department.findOne({ where: { id, businessId } });
        if (!dep)
            return false;
        await dep.destroy();
        return true;
    }
}
exports.DepartmentDAL = DepartmentDAL;
