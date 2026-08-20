import type { NextFunction, Request, Response } from "express";
import { SubscriptionService } from "../modules/subscription/subscription.service";

const subscriptionService = new SubscriptionService();

async function ensureSubscriptionAccess(req: Request, next: NextFunction) {
  if (!req.user) {
    next({ statusCode: 401, message: "Unauthorized" });
    return false;
  }
  if (req.user.isPlatformSuperAdmin || !req.user.businessId) return true;

  const access = await subscriptionService.evaluateAccess(req.user.businessId, req.method, req.user.roles || []);
  if (access.allowed) return true;

  next({
    statusCode: 403,
    message: access.mode === "read_only"
      ? "Subscription is currently read-only."
      : access.mode === "business_admin_only"
        ? "Subscription access is currently limited to Business Admin users."
        : access.mode === "billing_only"
          ? "Billing action is required before ERP access can continue."
          : "Subscription access is currently locked.",
    subscriptionStatus: access.status,
    accessMode: access.mode,
  });
  return false;
}

export function requirePermission(...permissionKeys: string[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!(await ensureSubscriptionAccess(req, next))) return;
      if (req.user!.isPlatformSuperAdmin) return next();
      const userPerms = new Set(req.user!.permissions || []);
      const ok = permissionKeys.every((key) => userPerms.has(key));
      if (!ok) return next({ statusCode: 403, message: "Forbidden (permission)" });
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAnyPermission(...permissionKeys: string[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!(await ensureSubscriptionAccess(req, next))) return;
      if (req.user!.isPlatformSuperAdmin) return next();
      const userPerms = new Set(req.user!.permissions || []);
      const ok = permissionKeys.some((key) => userPerms.has(key));
      if (!ok) return next({ statusCode: 403, message: "Forbidden (permission)" });
      next();
    } catch (error) {
      next(error);
    }
  };
}
