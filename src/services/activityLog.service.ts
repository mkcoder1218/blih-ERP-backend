import type { Request } from "express";
import { db } from "../models";

export class ActivityLogService {
  static async log(
    action: string,
    entityType: string,
    entityId: string,
    title: string,
    description: string | null,
    moduleKey: string,
    req: Request,
    metadata: Record<string, any> = {}
  ) {
    try {
      if (!req.user?.businessId) return;
      await db.ActivityLog.create({
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
    } catch {
      // never block main flow
    }
  }
}

