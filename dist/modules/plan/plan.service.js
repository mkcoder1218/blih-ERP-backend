"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanService = void 0;
const plan_dal_1 = require("./plan.dal");
class PlanService {
    constructor() {
        this.dal = new plan_dal_1.PlanDAL();
    }
    list() { return this.dal.findAll(); }
    getById(id) { return this.dal.findById(id); }
    create(data) { return this.dal.create(data); }
    update(id, data) { return this.dal.update(id, data); }
    remove(id) { return this.dal.softDelete(id); }
}
exports.PlanService = PlanService;
