"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserDAL = void 0;
const BaseDAL_1 = require("../../database/BaseDAL");
const models_1 = require("../../models");
class UserDAL extends BaseDAL_1.BaseDAL {
    constructor() {
        super(models_1.db.User);
    }
}
exports.UserDAL = UserDAL;
