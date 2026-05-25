"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessModuleService = void 0;
const businessModule_dal_1 = require("./businessModule.dal");
class BusinessModuleService {
    constructor() {
        this.dal = new businessModule_dal_1.BusinessModuleDAL();
    }
    list(businessId) { return this.dal.findAll({ businessId }); }
    getById(id, businessId) { return this.dal.findAll({ id, businessId }).then((res) => res[0]); }
    update(id, businessId, data) { return this.dal.update(id, data); }
}
exports.BusinessModuleService = BusinessModuleService;
