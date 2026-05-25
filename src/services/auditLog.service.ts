import { db } from "../models";
import type { Request } from "express";
import { ActivityLogger } from "../modules/activityLog/activity.service";

export class AuditLogService {
  static async log(
    action: string,
    entityType: string,
    entityId: string,
    beforeData: any = null,
    afterData: any = null,
    req?: any
  ) {
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
      await db.AuditLog.create({
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
