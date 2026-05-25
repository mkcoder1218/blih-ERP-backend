"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessModuleDAL = void 0;
const models_1 = require("../../models");
class BusinessModuleDAL {
    findAll(query) { return models_1.db.BusinessModule.findAll({ where: query }); }
    findById(id) { return models_1.db.BusinessModule.findByPk(id); }
    async update(id, data) {
        const mod = await models_1.db.BusinessModule.findByPk(id);
        if (!mod)
            return null;
        return mod.update(data);
    }
}
exports.BusinessModuleDAL = BusinessModuleDAL;
