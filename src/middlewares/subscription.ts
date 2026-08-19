import type { Request, Response, NextFunction } from "express";
import { SubscriptionService } from "../modules/subscription/subscription.service";

export const requireActiveSubscription = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.businessId) return res.status(401).json({ message: "Unauthorized" });
  if (!await SubscriptionService.isActive(req.user.businessId)) {
    return res.status(403).json({ message: "An active subscription is required." });
  }
  next();
};

export const requireFeature = (featureKey: string, quantity = 1) => async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user?.businessId) return res.status(401).json({ message: "Unauthorized" });
  const allowed = await new SubscriptionService().canUseFeature(req.user.businessId, featureKey, quantity);
  if (!allowed) {
    return res.status(403).json({ message: "This feature is not available on your current plan. Please upgrade your subscription." });
  }
  next();
};

export const requireUsageLimit = (featureKey: string) => requireFeature(featureKey);
