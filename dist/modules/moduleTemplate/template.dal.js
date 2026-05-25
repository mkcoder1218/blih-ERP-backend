"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateDAL = void 0;
const models_1 = require("../../models");
class TemplateDAL {
    findAll(query) {
        return models_1.db.ModuleTemplate.findAll({ where: query, order: [['createdAt', 'ASC']], include: ['forms', 'workflows'] });
    }
    findByKey(moduleKey) { return models_1.db.ModuleTemplate.findOne({ where: { moduleKey }, include: ['forms', 'workflows'] }); }
    async getBusinessModuleStatus(businessId, moduleKey) {
        return models_1.db.BusinessModule.findOne({ where: { businessId, moduleKey } });
    }
}
exports.TemplateDAL = TemplateDAL;
