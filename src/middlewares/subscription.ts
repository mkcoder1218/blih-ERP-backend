import type { Request, Response, NextFunction } from "express";
import { SubscriptionService } from "../modules/subscription/subscription.service";

const service = new SubscriptionService();

async function enforceAccess(req: Request, res: Response) {
  if (req.user?.isPlatformSuperAdmin) return true;
  if (!req.user?.businessId) {
    res.status(401).json({ message: "Unauthorized" });
    return false;
  }

  const access = await service.evaluateAccess(req.user.businessId, req.method, req.user.roles || []);
  if (!access.allowed) {
    res.status(403).json({
      message: access.mode === "read_only"
        ? "Your subscription currently allows read-only access."
        : access.mode === "business_admin_only"
          ? "Only a Business Admin can access the ERP while this subscription is restricted."
          : access.mode === "billing_only"
            ? "Your subscription requires billing action before ERP access can continue."
            : "Your subscription does not currently allow ERP access.",
      subscriptionStatus: access.status,
      accessMode: access.mode,
      graceEndsAt: access.graceEndsAt || null,
    });
    return false;
  }
  return true;
}

export const requireActiveSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (await enforceAccess(req, res)) next();
  } catch (error) {
    next(error);
  }
};

export const requireFeature = (featureKey: string, quantity = 1) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!(await enforceAccess(req, res))) return;
    if (req.user?.isPlatformSuperAdmin) return next();
    if (!req.user?.businessId) return res.status(401).json({ message: "Unauthorized" });

    const check = await service.checkFeatureLimit(req.user.businessId, featureKey, quantity);
    if (!check.allowed) {
      return res.status(402).json({
        message: check.message || "This feature is not available on your current plan. Please upgrade your subscription.",
        featureKey,
        used: check.used,
        limit: check.limit,
      });
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const requireUsageLimit = (featureKey: string) => requireFeature(featureKey);
