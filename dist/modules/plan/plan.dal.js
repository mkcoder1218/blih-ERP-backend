"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanDAL = void 0;
const models_1 = require("../../models");
class PlanDAL {
    findAll() { return models_1.db.Plan.findAll(); }
    findById(id) { return models_1.db.Plan.findByPk(id); }
    create(data) { return models_1.db.Plan.create(data); }
    async update(id, data) {
        const plan = await models_1.db.Plan.findByPk(id);
        if (!plan)
            return null;
        return plan.update(data);
    }
    async softDelete(id) {
        const plan = await models_1.db.Plan.findByPk(id);
        if (!plan)
            return null;
        await plan.destroy();
        return true;
    }
}
exports.PlanDAL = PlanDAL;
