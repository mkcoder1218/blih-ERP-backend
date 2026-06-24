"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionService = void 0;
const sequelize_1 = require("sequelize");
const models_1 = require("../../models");
const n = (value) => Number(value || 0);
const addCycle = (date, cycle) => {
    const result = new Date(date);
    cycle === "yearly" ? result.setFullYear(result.getFullYear() + 1) : result.setMonth(result.getMonth() + 1);
    return result;
};
class SubscriptionService {
    async getActiveSubscription(businessId) {
        return models_1.db.Subscription.findOne({
            where: { businessId, status: { [sequelize_1.Op.in]: ["active", "trialing"] } },
            include: [{ model: models_1.db.Plan, as: "Plan", required: true }]
        });
    }
    async getSubscription(businessId) {
        return models_1.db.Subscription.findOne({ where: { businessId }, include: [{ model: models_1.db.Plan }] });
    }
    async getEntitlement(businessId, featureKey) {
        const subscription = await this.getActiveSubscription(businessId);
        if (!subscription)
            return null;
        const feature = await models_1.db.Feature.findOne({ where: { key: featureKey } });
        if (!feature)
            return null;
        const planFeature = await models_1.db.PlanFeature.findOne({ where: { planId: subscription.planId, featureId: feature.id } });
        return planFeature?.isEnabled ? { subscription, feature, planFeature } : null;
    }
    async canUseFeature(businessId, featureKey, requestedQuantity = 1) {
        const result = await this.checkFeatureLimit(businessId, featureKey, requestedQuantity);
        return result.allowed;
    }
    async checkFeatureLimit(businessId, featureKey, requestedQuantity = 1) {
        const entitlement = await this.getEntitlement(businessId, featureKey);
        if (!entitlement)
            return { allowed: false, message: "Feature is not enabled for the current plan." };
        const { subscription, feature, planFeature } = entitlement;
        if (planFeature.limitValue == null)
            return { allowed: true, used: 0, limit: null };
        let used = 0;
        if (featureKey === "employee_limit") {
            used = await models_1.db.User.count({ where: { businessId, status: "active" } });
        }
        else {
            const where = { businessId, subscriptionId: subscription.id, featureId: feature.id };
            const period = this.periodBounds(planFeature.limitPeriod, new Date());
            if (period)
                where.usageDate = { [sequelize_1.Op.gte]: period.start, [sequelize_1.Op.lt]: period.end };
            used = n(await models_1.db.UsageRecord.sum("quantity", { where }));
        }
        const limit = n(planFeature.limitValue);
        const allowed = used + n(requestedQuantity) <= limit;
        return { allowed, used, limit, message: allowed ? undefined : `${feature.name} limit exceeded (${used + n(requestedQuantity)}/${limit}).` };
    }
    periodBounds(period, date) {
        if (!period || period === "lifetime")
            return null;
        const start = new Date(date);
        if (period === "daily")
            start.setHours(0, 0, 0, 0);
        if (period === "monthly") {
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
        }
        if (period === "yearly") {
            start.setMonth(0, 1);
            start.setHours(0, 0, 0, 0);
        }
        const end = new Date(start);
        if (period === "daily")
            end.setDate(end.getDate() + 1);
        if (period === "monthly")
            end.setMonth(end.getMonth() + 1);
        if (period === "yearly")
            end.setFullYear(end.getFullYear() + 1);
        return { start, end };
    }
    async calculateSeatCharge(businessId, planId) {
        const plan = await models_1.db.Plan.findByPk(planId);
        if (!plan)
            throw new Error("Plan not found.");
        const seats = await models_1.db.User.count({ where: { businessId, status: "active" } });
        const extraSeats = Math.max(0, seats - n(plan.includedSeats));
        return { activeSeats: seats, extraSeats, seatAmount: extraSeats * n(plan.extraSeatPrice) };
    }
    async calculateUsageCharge(subscriptionId, periodStart, periodEnd) {
        return n(await models_1.db.UsageRecord.sum("totalPrice", {
            where: { subscriptionId, usageDate: { [sequelize_1.Op.gte]: periodStart, [sequelize_1.Op.lt]: periodEnd } }
        }));
    }
    async generateInvoice(subscriptionId, adjustments = {}) {
        const subscription = await models_1.db.Subscription.findByPk(subscriptionId, { include: [{ model: models_1.db.Plan }] });
        if (!subscription)
            throw new Error("Subscription not found.");
        const plan = subscription.Plan;
        const seat = await this.calculateSeatCharge(subscription.businessId, subscription.planId);
        const usageAmount = await this.calculateUsageCharge(subscription.id, subscription.currentPeriodStart, subscription.currentPeriodEnd);
        const baseAmount = n(plan.basePrice);
        const discountAmount = n(adjustments.discountAmount);
        const taxAmount = n(adjustments.taxAmount);
        const totalAmount = Math.max(0, baseAmount + seat.seatAmount + usageAmount - discountAmount + taxAmount);
        const invoiceNumber = `SUB-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${subscription.id.slice(0, 8).toUpperCase()}`;
        return models_1.db.SubscriptionInvoice.create({
            businessId: subscription.businessId, subscriptionId, invoiceNumber, baseAmount,
            seatAmount: seat.seatAmount, usageAmount, discountAmount, taxAmount, totalAmount,
            currency: plan.currency, status: "issued", periodStart: subscription.currentPeriodStart,
            periodEnd: subscription.currentPeriodEnd, dueDate: adjustments.dueDate || subscription.currentPeriodEnd
        });
    }
    async changePlan(businessId, planId, force = false) {
        const subscription = await models_1.db.Subscription.findOne({ where: { businessId } });
        const target = await models_1.db.Plan.findByPk(planId);
        if (!subscription || !target || !target.isActive)
            throw new Error("Subscription or active target plan not found.");
        const current = await models_1.db.Plan.findByPk(subscription.planId);
        const downgrade = n(target.basePrice) < n(current.basePrice);
        await this.validatePlanLimits(businessId, planId);
        if (downgrade && !force)
            return subscription.update({ pendingPlanId: planId });
        const now = new Date();
        return subscription.update({
            planId, pendingPlanId: null, status: "active", cancelAtPeriodEnd: false,
            currentPeriodStart: now, currentPeriodEnd: addCycle(now, target.billingCycle)
        });
    }
    async validatePlanLimits(businessId, planId) {
        const employee = await models_1.db.Feature.findOne({ where: { key: "employee_limit" } });
        if (!employee)
            return;
        const entitlement = await models_1.db.PlanFeature.findOne({ where: { planId, featureId: employee.id, isEnabled: true } });
        if (entitlement?.limitValue != null) {
            const count = await models_1.db.User.count({ where: { businessId, status: "active" } });
            if (count > n(entitlement.limitValue)) {
                const plan = await models_1.db.Plan.findByPk(planId);
                throw new Error(`You currently have ${count} employees, but the ${plan.name} plan allows only ${n(entitlement.limitValue)} employees.`);
            }
        }
    }
    async cancel(businessId) {
        const sub = await models_1.db.Subscription.findOne({ where: { businessId } });
        if (!sub)
            throw new Error("No subscription found.");
        return sub.update({ cancelAtPeriodEnd: true, canceledAt: new Date() });
    }
    async reactivate(businessId) {
        const sub = await models_1.db.Subscription.findOne({ where: { businessId } });
        if (!sub)
            throw new Error("No subscription found.");
        if (sub.status === "expired")
            throw new Error("Expired subscriptions cannot be reactivated.");
        return sub.update({ status: "active", cancelAtPeriodEnd: false, canceledAt: null });
    }
    async getFeatures(businessId) {
        const sub = await this.getSubscription(businessId);
        if (!sub)
            return [];
        return models_1.db.PlanFeature.findAll({ where: { planId: sub.planId }, include: [{ model: models_1.db.Feature, as: "feature" }] });
    }
    async getUsage(businessId) {
        return models_1.db.UsageRecord.findAll({ where: { businessId }, include: [{ model: models_1.db.Feature, as: "feature" }], order: [["usageDate", "DESC"]] });
    }
    async getInvoices(businessId) {
        return models_1.db.SubscriptionInvoice.findAll({ where: { businessId }, order: [["createdAt", "DESC"]] });
    }
    static async isActive(businessId) {
        return Boolean(await models_1.db.Subscription.findOne({ where: { businessId, status: { [sequelize_1.Op.in]: ["active", "trialing"] } } }));
    }
}
exports.SubscriptionService = SubscriptionService;
