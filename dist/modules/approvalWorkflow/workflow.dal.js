"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowDAL = void 0;
const models_1 = require("../../models");
class WorkflowDAL {
    findAll(query, offset, limit) {
        return models_1.db.ApprovalWorkflow.findAndCountAll({ where: query, offset, limit, order: [['createdAt', 'DESC']], include: ['steps'] });
    }
    findById(id, businessId) { return models_1.db.ApprovalWorkflow.findOne({ where: { id, businessId }, include: ['steps'] }); }
    create(data) { return models_1.db.ApprovalWorkflow.create(data); }
    createStep(data) { return models_1.db.ApprovalStep.create(data); }
    async deleteStep(stepId, businessId) {
        const step = await models_1.db.ApprovalStep.findOne({ where: { id: stepId, businessId } });
        if (step) {
            await step.destroy();
            return true;
        }
        return false;
    }
}
exports.WorkflowDAL = WorkflowDAL;
