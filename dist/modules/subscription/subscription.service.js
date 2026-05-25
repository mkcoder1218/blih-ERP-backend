"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionService = void 0;
const models_1 = require("../../models");
class SubscriptionService {
    async assignSubscription(businessId, planId) {
        const sub = await models_1.db.Subscription.upsert({
            businessId,
            planId,
            status: 'active',
            billingCycle: 'monthly',
            startDate: new Date()
        });
        // Initialize limits if plan exists
        if (models_1.db.Plan) {
            const plan = await models_1.db.Plan.findOne({ where: { id: planId } });
            if (plan && plan.features) {
                // mock extracting features user limit
                const maxUsers = plan.features.maxUsers || 5;
                await models_1.db.UsageLimit.upsert({
                    businessId, planId, key: 'users', limitValue: maxUsers, currentValue: 1 // assuming 1 admin
                });
            }
        }
        return sub;
    }
    async getSubscription(businessId) {
        return models_1.db.Subscription.findOne({ where: { businessId }, include: [{ model: models_1.db.Plan }] });
    }
    async cancelSubscription(businessId) {
        const sub = await models_1.db.Subscription.findOne({ where: { businessId } });
        if (!sub)
            throw new Error("No subscription");
        await sub.update({ status: 'cancelled', cancelledAt: new Date() });
        return sub;
    }
    async createInvoice(businessId, data) {
        const sub = await models_1.db.Subscription.findOne({ where: { businessId } });
        if (!sub)
            throw new Error("No subscription mapped.");
        return models_1.db.SubscriptionInvoice.create({ ...data, businessId, subscriptionId: sub.id });
    }
    async recordPayment(businessId, invoiceId, data) {
        const inv = await models_1.db.SubscriptionInvoice.findOne({ where: { id: invoiceId, businessId } });
        if (!inv)
            throw new Error("Invoice not found");
        const payment = await models_1.db.SubscriptionPayment.create({ ...data, businessId, subscriptionInvoiceId: inv.id });
        if (data.status === 'confirmed') {
            await inv.update({ status: 'paid', paidAt: new Date() });
            await models_1.db.Subscription.update({ status: 'active' }, { where: { id: inv.subscriptionId } });
        }
        return payment;
    }
    async getInvoices(businessId) {
        return models_1.db.SubscriptionInvoice.findAll({ where: { businessId }, order: [['createdAt', 'DESC']] });
    }
    // --- Limits & Checks ---
    // A static helper designed for middlewares
    static async checkLimit(businessId, key) {
        const limit = await models_1.db.UsageLimit.findOne({ where: { businessId, key } });
        if (!limit)
            return true; // No explicit boundary mapped
        if (limit.limitValue === -1)
            return true; // Unlimited
        // Live mapping recalculation stub natively depending on key
        if (key === 'users') {
            const actualCount = await models_1.db.User.count({ where: { businessId, status: 'active' } });
            await limit.update({ currentValue: actualCount });
            return actualCount < limit.limitValue;
        }
        return limit.currentValue < limit.limitValue;
    }
    static async isActive(businessId) {
        const sub = await models_1.db.Subscription.findOne({ where: { businessId } });
        if (!sub)
            return true; // Gracefully permit if subsystem completely inactive / legacy
        const blockedStatuses = ['suspended', 'expired', 'past_due', 'cancelled'];
        return !blockedStatuses.includes(sub.status);
    }
}
exports.SubscriptionService = SubscriptionService;
