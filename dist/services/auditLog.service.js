"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogService = void 0;
const models_1 = require("../models");
const activity_service_1 = require("../modules/activityLog/activity.service");
/** Derive a short human-readable device label from User-Agent string */
function parseDeviceInfo(ua) {
    if (!ua)
        return "Unknown Device";
    if (/mobile/i.test(ua)) {
        if (/android/i.test(ua))
            return "Android Mobile";
        if (/iphone/i.test(ua))
            return "iPhone";
        return "Mobile Device";
    }
    if (/tablet|ipad/i.test(ua))
        return "Tablet";
    if (/windows/i.test(ua))
        return "Windows PC";
    if (/macintosh|mac os/i.test(ua))
        return "Mac";
    if (/linux/i.test(ua))
        return "Linux PC";
    return "Desktop Browser";
}
class AuditLogService {
    static async log(action, entityType, entityId, beforeData = null, afterData = null, req, category = "success") {
        let businessId = null;
        let userId = null;
        let ipAddress = null;
        let userAgent = null;
        let deviceInfo = null;
        if (req) {
            businessId = req.user?.businessId || null;
            userId = req.user?.id || null;
            ipAddress =
                req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
                    req.ip ||
                    req.connection?.remoteAddress ||
                    null;
            userAgent = req.headers?.["user-agent"] || null;
            deviceInfo = parseDeviceInfo(userAgent);
        }
        try {
            await models_1.db.AuditLog.create({
                businessId,
                userId,
                action,
                entityType,
                entityId,
                category,
                beforeData,
                afterData,
                ipAddress,
                userAgent,
                deviceInfo,
                location: ipAddress // can be geo-enriched later; default to IP
            });
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
