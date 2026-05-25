"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessDAL = void 0;
const BaseDAL_1 = require("../../database/BaseDAL");
const models_1 = require("../../models");
class BusinessDAL extends BaseDAL_1.BaseDAL {
    constructor() {
        super(models_1.db.Business);
    }
}
exports.BusinessDAL = BusinessDAL;
