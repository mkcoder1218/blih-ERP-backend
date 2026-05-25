"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefinitionService = void 0;
const definition_dal_1 = require("./definition.dal");
const sequelize_1 = require("sequelize");
class DefinitionService {
    constructor() {
        this.dal = new definition_dal_1.DefinitionDAL();
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
    createField(businessId, data) { return this.dal.createField({ ...data, businessId }); }
    updateField(id, businessId, data) { return this.dal.updateField(id, businessId, data); }
    deleteField(id, businessId) { return this.dal.deleteField(id, businessId); }
}
exports.DefinitionService = DefinitionService;
