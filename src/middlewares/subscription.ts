
import type { Request, Response, NextFunction } from 'express';
import { SubscriptionService } from '../modules/subscription/subscription.service';

export const requireActiveSubscription = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.businessId) return res.status(401).json({ message: 'Unauthorized' });
  const isActive = await SubscriptionService.isActive(req.user.businessId);
  if (!isActive) {
     return res.status(403).json({ message: 'Subscription is suspended, cancelled, or expired. Please renew.' });
  }
  next();
};

export const requireUsageLimit = (limitKey: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.businessId) return res.status(401).json({ message: 'Unauthorized' });
    const isUnderLimit = await SubscriptionService.checkLimit(req.user.businessId, limitKey);
    if (!isUnderLimit) {
      return res.status(402).json({ message: `Limit reached for metric: ${limitKey}. Please upgrade your plan.` });
    }
    next();
  };
};
