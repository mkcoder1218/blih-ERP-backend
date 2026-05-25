"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityLogService = void 0;
const models_1 = require("../models");
class ActivityLogService {
    static async log(action, entityType, entityId, title, description, moduleKey, req, metadata = {}) {
        try {
            if (!req.user?.businessId)
                return;
            await models_1.db.ActivityLog.create({
                businessId: req.user.businessId,
                userId: req.user.id,
                moduleKey,
                action,
                entityType,
                entityId,
                title,
                description,
                metadata
            });
        }
        catch {
            // never block main flow
        }
    }
}
exports.ActivityLogService = ActivityLogService;
