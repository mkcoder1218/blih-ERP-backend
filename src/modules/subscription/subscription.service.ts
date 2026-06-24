import { Op, fn, col } from "sequelize";
import { db } from "../../models";

const n = (value: unknown) => Number(value || 0);
const addCycle = (date: Date, cycle: string) => {
  const result = new Date(date);
  cycle === "yearly" ? result.setFullYear(result.getFullYear() + 1) : result.setMonth(result.getMonth() + 1);
  return result;
};

export class SubscriptionService {
  async getActiveSubscription(businessId: string) {
    return db.Subscription.findOne({
      where: { businessId, status: { [Op.in]: ["active", "trialing"] } },
      include: [{ model: db.Plan, as: "Plan", required: true }]
    });
  }

  async getSubscription(businessId: string) {
    return db.Subscription.findOne({ where: { businessId }, include: [{ model: db.Plan }] });
  }

  async getEntitlement(businessId: string, featureKey: string) {
    const subscription = await this.getActiveSubscription(businessId);
    if (!subscription) return null;
    const feature = await db.Feature.findOne({ where: { key: featureKey } });
    if (!feature) return null;
    const planFeature = await db.PlanFeature.findOne({ where: { planId: subscription.planId, featureId: feature.id } });
    return planFeature?.isEnabled ? { subscription, feature, planFeature } : null;
  }

  async canUseFeature(businessId: string, featureKey: string, requestedQuantity = 1) {
    const result = await this.checkFeatureLimit(businessId, featureKey, requestedQuantity);
    return result.allowed;
  }

  async checkFeatureLimit(businessId: string, featureKey: string, requestedQuantity = 1) {
    const entitlement = await this.getEntitlement(businessId, featureKey);
    if (!entitlement) return { allowed: false, message: "Feature is not enabled for the current plan." };
    const { subscription, feature, planFeature } = entitlement;
    if (planFeature.limitValue == null) return { allowed: true, used: 0, limit: null };

    let used = 0;
    if (featureKey === "employee_limit") {
      used = await db.User.count({ where: { businessId, status: "active" } });
    } else {
      const where: any = { businessId, subscriptionId: subscription.id, featureId: feature.id };
      const period = this.periodBounds(planFeature.limitPeriod, new Date());
      if (period) where.usageDate = { [Op.gte]: period.start, [Op.lt]: period.end };
      used = n(await db.UsageRecord.sum("quantity", { where }));
    }
    const limit = n(planFeature.limitValue);
    const allowed = used + n(requestedQuantity) <= limit;
    return { allowed, used, limit, message: allowed ? undefined : `${feature.name} limit exceeded (${used + n(requestedQuantity)}/${limit}).` };
  }

  periodBounds(period: string | null, date: Date) {
    if (!period || period === "lifetime") return null;
    const start = new Date(date);
    if (period === "daily") start.setHours(0, 0, 0, 0);
    if (period === "monthly") { start.setDate(1); start.setHours(0, 0, 0, 0); }
    if (period === "yearly") { start.setMonth(0, 1); start.setHours(0, 0, 0, 0); }
    const end = new Date(start);
    if (period === "daily") end.setDate(end.getDate() + 1);
    if (period === "monthly") end.setMonth(end.getMonth() + 1);
    if (period === "yearly") end.setFullYear(end.getFullYear() + 1);
    return { start, end };
  }

  async calculateSeatCharge(businessId: string, planId: string) {
    const plan = await db.Plan.findByPk(planId);
    if (!plan) throw new Error("Plan not found.");
    const seats = await db.User.count({ where: { businessId, status: "active" } });
    const extraSeats = Math.max(0, seats - n(plan.includedSeats));
    return { activeSeats: seats, extraSeats, seatAmount: extraSeats * n(plan.extraSeatPrice) };
  }

  async calculateUsageCharge(subscriptionId: string, periodStart: Date, periodEnd: Date) {
    return n(await db.UsageRecord.sum("totalPrice", {
      where: { subscriptionId, usageDate: { [Op.gte]: periodStart, [Op.lt]: periodEnd } }
    }));
  }

  async generateInvoice(subscriptionId: string, adjustments: { discountAmount?: number; taxAmount?: number; dueDate?: Date } = {}) {
    const subscription = await db.Subscription.findByPk(subscriptionId, { include: [{ model: db.Plan }] });
    if (!subscription) throw new Error("Subscription not found.");
    const plan = subscription.Plan;
    const seat = await this.calculateSeatCharge(subscription.businessId, subscription.planId);
    const usageAmount = await this.calculateUsageCharge(subscription.id, subscription.currentPeriodStart, subscription.currentPeriodEnd);
    const baseAmount = n(plan.basePrice);
    const discountAmount = n(adjustments.discountAmount);
    const taxAmount = n(adjustments.taxAmount);
    const totalAmount = Math.max(0, baseAmount + seat.seatAmount + usageAmount - discountAmount + taxAmount);
    const invoiceNumber = `SUB-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${subscription.id.slice(0, 8).toUpperCase()}`;
    return db.SubscriptionInvoice.create({
      businessId: subscription.businessId, subscriptionId, invoiceNumber, baseAmount,
      seatAmount: seat.seatAmount, usageAmount, discountAmount, taxAmount, totalAmount,
      currency: plan.currency, status: "issued", periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd, dueDate: adjustments.dueDate || subscription.currentPeriodEnd
    });
  }

  async changePlan(businessId: string, planId: string, force = false) {
    const subscription = await db.Subscription.findOne({ where: { businessId } });
    const target = await db.Plan.findByPk(planId);
    if (!subscription || !target || !target.isActive) throw new Error("Subscription or active target plan not found.");
    const current = await db.Plan.findByPk(subscription.planId);
    const downgrade = n(target.basePrice) < n(current.basePrice);
    await this.validatePlanLimits(businessId, planId);
    if (downgrade && !force) return subscription.update({ pendingPlanId: planId });
    const now = new Date();
    return subscription.update({
      planId, pendingPlanId: null, status: "active", cancelAtPeriodEnd: false,
      currentPeriodStart: now, currentPeriodEnd: addCycle(now, target.billingCycle)
    });
  }

  async validatePlanLimits(businessId: string, planId: string) {
    const employee = await db.Feature.findOne({ where: { key: "employee_limit" } });
    if (!employee) return;
    const entitlement = await db.PlanFeature.findOne({ where: { planId, featureId: employee.id, isEnabled: true } });
    if (entitlement?.limitValue != null) {
      const count = await db.User.count({ where: { businessId, status: "active" } });
      if (count > n(entitlement.limitValue)) {
        const plan = await db.Plan.findByPk(planId);
        throw new Error(`You currently have ${count} employees, but the ${plan.name} plan allows only ${n(entitlement.limitValue)} employees.`);
      }
    }
  }

  async cancel(businessId: string) {
    const sub = await db.Subscription.findOne({ where: { businessId } });
    if (!sub) throw new Error("No subscription found.");
    return sub.update({ cancelAtPeriodEnd: true, canceledAt: new Date() });
  }

  async reactivate(businessId: string) {
    const sub = await db.Subscription.findOne({ where: { businessId } });
    if (!sub) throw new Error("No subscription found.");
    if (sub.status === "expired") throw new Error("Expired subscriptions cannot be reactivated.");
    return sub.update({ status: "active", cancelAtPeriodEnd: false, canceledAt: null });
  }

  async getFeatures(businessId: string) {
    const sub = await this.getSubscription(businessId);
    if (!sub) return [];
    return db.PlanFeature.findAll({ where: { planId: sub.planId }, include: [{ model: db.Feature, as: "feature" }] });
  }

  async getUsage(businessId: string) {
    return db.UsageRecord.findAll({ where: { businessId }, include: [{ model: db.Feature, as: "feature" }], order: [["usageDate", "DESC"]] });
  }

  async getInvoices(businessId: string) {
    return db.SubscriptionInvoice.findAll({ where: { businessId }, order: [["createdAt", "DESC"]] });
  }

  static async isActive(businessId: string) {
    return Boolean(await db.Subscription.findOne({ where: { businessId, status: { [Op.in]: ["active", "trialing"] } } }));
  }
}
