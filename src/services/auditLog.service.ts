import { db } from "../models";
import { ActivityLogger } from "../modules/activityLog/activity.service";

/** Derive a short human-readable device label from User-Agent string */
function parseDeviceInfo(ua: string | undefined | null): string {
  if (!ua) return "Unknown Device";
  if (/mobile/i.test(ua)) {
    if (/android/i.test(ua)) return "Android Mobile";
    if (/iphone/i.test(ua)) return "iPhone";
    return "Mobile Device";
  }
  if (/tablet|ipad/i.test(ua)) return "Tablet";
  if (/windows/i.test(ua)) return "Windows PC";
  if (/macintosh|mac os/i.test(ua)) return "Mac";
  if (/linux/i.test(ua)) return "Linux PC";
  return "Desktop Browser";
}

export type AuditCategory = "success" | "warning" | "error";

export class AuditLogService {
  static async log(
    action: string,
    entityType: string,
    entityId: string,
    beforeData: any = null,
    afterData: any = null,
    req?: any,
    category: AuditCategory = "success"
  ) {
    let businessId: string | null = null;
    let userId: string | null = null;
    let ipAddress: string | null = null;
    let userAgent: string | null = null;
    let deviceInfo: string | null = null;

    if (req) {
      businessId = req.user?.businessId || null;
      userId = req.user?.id || null;
      ipAddress =
        (req.headers?.["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
        req.ip ||
        req.connection?.remoteAddress ||
        null;
      userAgent = req.headers?.["user-agent"] || null;
      deviceInfo = parseDeviceInfo(userAgent);
    }

    try {
      await db.AuditLog.create({
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
        await ActivityLogger.log({
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
    } catch (err) {
      console.error("Failed to create audit log or activity", err);
    }
  }
}
