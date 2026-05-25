"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowService = void 0;
const workflow_dal_1 = require("./workflow.dal");
const sequelize_1 = require("sequelize");
class WorkflowService {
    constructor() {
        this.dal = new workflow_dal_1.WorkflowDAL();
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
    createStep(businessId, data) { return this.dal.createStep({ ...data, businessId }); }
    deleteStep(stepId, businessId) { return this.dal.deleteStep(stepId, businessId); }
}
exports.WorkflowService = WorkflowService;
