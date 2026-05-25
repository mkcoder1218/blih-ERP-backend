"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmissionDAL = void 0;
const models_1 = require("../../models");
class SubmissionDAL {
    findAll(query, offset, limit) {
        return models_1.db.FormSubmission.findAndCountAll({ where: query, offset, limit, order: [['createdAt', 'DESC']] });
    }
    findById(id, businessId) { return models_1.db.FormSubmission.findOne({ where: { id, businessId } }); }
    create(data) { return models_1.db.FormSubmission.create(data); }
    async getFormDefinition(id, businessId) {
        return models_1.db.FormDefinition.findOne({ where: { id, businessId, status: 'active' }, include: ['fields'] });
    }
}
exports.SubmissionDAL = SubmissionDAL;
