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
    let isTestActivity = false;
    let testerLevel: string | null = null;

    if (req) {
      businessId = req.user?.businessId || null;
      userId = req.user?.id || null;
      isTestActivity = Boolean(req.user?.isTestAccount);
      testerLevel = req.user?.testerLevel || null;
      ipAddress =
        (req.headers?.["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
        req.ip ||
        req.connection?.remoteAddress ||
        null;
      userAgent = req.headers?.["user-agent"] || null;
      deviceInfo = parseDeviceInfo(userAgent);
    }

    const effectiveCategory: AuditCategory =
      isTestActivity && category === "success" ? "warning" : category;
    const effectiveDeviceInfo = isTestActivity
      ? `[TEST${testerLevel ? `:${testerLevel}` : ""}] ${deviceInfo || "Unknown Device"}`
      : deviceInfo;

    try {
      await db.AuditLog.create({
        businessId,
        userId,
        action,
        entityType,
        entityId,
        category: effectiveCategory,
        beforeData,
        afterData,
        ipAddress,
        userAgent,
        deviceInfo: effectiveDeviceInfo,
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
          title: isTestActivity
            ? `[TEST ACCOUNT] ${action} on ${entityType}`
            : `Action on ${entityType}: ${action}`,
          description: isTestActivity
            ? `Tester activity recorded automatically (${testerLevel || "STANDARD"}).`
            : `System recorded ${action} automatically.`
        });
      }
    } catch (err) {
      console.error("Failed to create audit log or activity", err);
    }
  }
}
