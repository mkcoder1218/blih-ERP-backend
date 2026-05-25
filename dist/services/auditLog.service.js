"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogService = void 0;
const models_1 = require("../models");
const activity_service_1 = require("../modules/activityLog/activity.service");
class AuditLogService {
    static async log(action, entityType, entityId, beforeData = null, afterData = null, req) {
        let businessId = null;
        let userId = null;
        let ipAddress = null;
        let userAgent = null;
        if (req) {
            businessId = req.user?.businessId || null;
            userId = req.user?.id || null;
            ipAddress = req.ip || req.connection?.remoteAddress || null;
            userAgent = req.headers?.["user-agent"] || null;
        }
        try {
            await models_1.db.AuditLog.create({
                businessId,
                userId,
                action,
                entityType,
                entityId,
                beforeData,
                afterData,
                ipAddress,
                userAgent
            });
            // Auto-dispatch public-facing activity log directly within AuditLog logic
            if (businessId) {
                await activity_service_1.ActivityLogger.log({
                    businessId,
                    userId: userId || undefined,
                    moduleKey: entityType,
                    action,
                    entityType,
                    entityId,
                    title: `Action on ${entityType}: ${action}`,
                    description: `System recorded ${action} automatically.`
                });
            }
        }
        catch (err) {
            console.error("Failed to create audit log or activity", err);
        }
    }
}
exports.AuditLogService = AuditLogService;
