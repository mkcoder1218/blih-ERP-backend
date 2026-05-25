"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityLogger = exports.ActivityService = void 0;
const activity_dal_1 = require("./activity.dal");
const sequelize_1 = require("sequelize");
class ActivityService {
    constructor() {
        this.dal = new activity_dal_1.ActivityDAL();
    }
    list(businessId, queryOpts, page, size) {
        const offset = (page - 1) * size;
        const query = { businessId };
        if (queryOpts.moduleKey)
            query.moduleKey = queryOpts.moduleKey;
        if (queryOpts.entityType)
            query.entityType = queryOpts.entityType;
        if (queryOpts.entityId)
            query.entityId = queryOpts.entityId;
        if (queryOpts.userId)
            query.userId = queryOpts.userId;
        if (queryOpts.startDate && queryOpts.endDate) {
            query.createdAt = { [sequelize_1.Op.between]: [new Date(queryOpts.startDate), new Date(queryOpts.endDate)] };
        }
        return this.dal.findAll(query, offset, size);
    }
    // Internal Reusable dispatch mechanism mapped heavily by auditLog logic hook
    async log(data) {
        return this.dal.create(data);
    }
}
exports.ActivityService = ActivityService;
exports.ActivityLogger = new ActivityService();
