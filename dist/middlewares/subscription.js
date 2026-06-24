"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireUsageLimit = exports.requireFeature = exports.requireActiveSubscription = void 0;
const subscription_service_1 = require("../modules/subscription/subscription.service");
const requireActiveSubscription = async (req, res, next) => {
    if (!req.user?.businessId)
        return res.status(401).json({ message: "Unauthorized" });
    if (!await subscription_service_1.SubscriptionService.isActive(req.user.businessId)) {
        return res.status(403).json({ message: "An active subscription is required." });
    }
    next();
};
exports.requireActiveSubscription = requireActiveSubscription;
const requireFeature = (featureKey, quantity = 1) => async (req, res, next) => {
    if (!req.user?.businessId)
        return res.status(401).json({ message: "Unauthorized" });
    const allowed = await new subscription_service_1.SubscriptionService().canUseFeature(req.user.businessId, featureKey, quantity);
    if (!allowed) {
        return res.status(403).json({ message: "This feature is not available on your current plan. Please upgrade your subscription." });
    }
    next();
};
exports.requireFeature = requireFeature;
const requireUsageLimit = (featureKey) => (0, exports.requireFeature)(featureKey);
exports.requireUsageLimit = requireUsageLimit;
