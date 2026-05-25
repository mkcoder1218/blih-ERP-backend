"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityDAL = void 0;
const models_1 = require("../../models");
class ActivityDAL {
    findAll(query, offset, limit) {
        return models_1.db.ActivityLog.findAndCountAll({ where: query, offset, limit, order: [['createdAt', 'DESC']] });
    }
    create(data) { return models_1.db.ActivityLog.create(data); }
}
exports.ActivityDAL = ActivityDAL;
