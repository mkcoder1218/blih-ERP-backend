import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { db } from "../models";
import { SubscriptionService } from "../modules/subscription/subscription.service";

const subscriptionService = new SubscriptionService();

function parseBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

export const requireActiveModule = (moduleKey: string) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const token = parseBearer(req);
      if (!token) return next({ statusCode: 401, message: "Missing access token" });

      const decoded = jwt.verify(token, env.jwtAccessSecret) as any;
      const businessId = req.user?.businessId || decoded?.businessId;
      const roles: string[] = req.user?.roles || decoded?.roles || [];
      const isPlatformSuperAdmin =
        Boolean(req.user?.isPlatformSuperAdmin) ||
        Boolean(decoded?.isPlatformSuperAdmin) ||
        roles.includes("PLATFORM_SUPER_ADMIN");

      if (isPlatformSuperAdmin) return next();
      if (!businessId) return next({ statusCode: 401, message: "Invalid access token" });

      const access = await subscriptionService.evaluateAccess(businessId, req.method, roles);
      if (!access.allowed) {
        return next({
          statusCode: 403,
          message: access.mode === "billing_only"
            ? "Billing action is required before ERP access can continue."
            : access.mode === "read_only"
              ? "Subscription is currently read-only."
              : "Subscription does not currently allow this action.",
          subscriptionStatus: access.status,
          accessMode: access.mode,
        });
      }

      const bm = await db.BusinessModule.findOne({
        where: { businessId, moduleKey, status: "active" },
      });
      if (!bm) return next({ statusCode: 403, message: `Module '${moduleKey}' is not active` });
      next();
    } catch {
      next({ statusCode: 401, message: "Invalid or expired token" });
    }
  };
};
