"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefinitionDAL = void 0;
const models_1 = require("../../models");
class DefinitionDAL {
    findAll(query, offset, limit) {
        return models_1.db.FormDefinition.findAndCountAll({ where: query, offset, limit, order: [['createdAt', 'DESC']], include: ['fields'] });
    }
    findById(id, businessId) { return models_1.db.FormDefinition.findOne({ where: { id, businessId }, include: ['fields'] }); }
    create(data) { return models_1.db.FormDefinition.create(data); }
    async update(id, businessId, data) {
        const f = await models_1.db.FormDefinition.findOne({ where: { id, businessId } });
        if (f)
            return f.update(data);
        return null;
    }
    createField(data) { return models_1.db.FormField.create(data); }
    async updateField(id, businessId, data) {
        const f = await models_1.db.FormField.findOne({ where: { id, businessId } });
        if (f)
            return f.update(data);
        return null;
    }
    async deleteField(id, businessId) {
        const f = await models_1.db.FormField.findOne({ where: { id, businessId } });
        if (f) {
            await f.destroy();
            return true;
        }
        return false;
    }
}
exports.DefinitionDAL = DefinitionDAL;
