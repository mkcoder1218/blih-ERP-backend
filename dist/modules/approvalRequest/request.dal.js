"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestDAL = void 0;
const models_1 = require("../../models");
class RequestDAL {
    findAll(query, offset, limit) {
        return models_1.db.ApprovalRequest.findAndCountAll({ where: query, offset, limit, order: [['createdAt', 'DESC']], include: [{ model: models_1.db.ApprovalStep, as: 'currentStep' }] });
    }
    findById(id, businessId) {
        return models_1.db.ApprovalRequest.findOne({ where: { id, businessId }, include: ['workflow', 'currentStep', 'actions'] });
    }
    getFirstStep(workflowId) {
        return models_1.db.ApprovalStep.findOne({ where: { workflowId }, order: [['stepOrder', 'ASC']] });
    }
    getNextStep(workflowId, currentOrder) {
        const { Op } = require('sequelize');
        return models_1.db.ApprovalStep.findOne({ where: { workflowId, stepOrder: { [Op.gt]: currentOrder } }, order: [['stepOrder', 'ASC']] });
    }
    createRequest(data) { return models_1.db.ApprovalRequest.create(data); }
    createAction(data) { return models_1.db.ApprovalAction.create(data); }
}
exports.RequestDAL = RequestDAL;
