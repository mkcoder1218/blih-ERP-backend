"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireUsageLimit = exports.requireActiveSubscription = void 0;
const subscription_service_1 = require("../modules/subscription/subscription.service");
const requireActiveSubscription = async (req, res, next) => {
    if (!req.user || !req.user.businessId)
        return res.status(401).json({ message: 'Unauthorized' });
    const isActive = await subscription_service_1.SubscriptionService.isActive(req.user.businessId);
    if (!isActive) {
        return res.status(403).json({ message: 'Subscription is suspended, cancelled, or expired. Please renew.' });
    }
    next();
};
exports.requireActiveSubscription = requireActiveSubscription;
const requireUsageLimit = (limitKey) => {
    return async (req, res, next) => {
        if (!req.user || !req.user.businessId)
            return res.status(401).json({ message: 'Unauthorized' });
        const isUnderLimit = await subscription_service_1.SubscriptionService.checkLimit(req.user.businessId, limitKey);
        if (!isUnderLimit) {
            return res.status(402).json({ message: `Limit reached for metric: ${limitKey}. Please upgrade your plan.` });
        }
        next();
    };
};
exports.requireUsageLimit = requireUsageLimit;
