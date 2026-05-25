
import { db } from '../../models';

export class SubscriptionService {

  async assignSubscription(businessId: string, planId: string) {
    const sub = await db.Subscription.upsert({
      businessId,
      planId,
      status: 'active',
      billingCycle: 'monthly',
      startDate: new Date()
    });

    // Initialize limits if plan exists
    if (db.Plan) {
      const plan = await db.Plan.findOne({ where: { id: planId } });
      if (plan && plan.features) {
         // mock extracting features user limit
         const maxUsers = plan.features.maxUsers || 5;
         await db.UsageLimit.upsert({
             businessId, planId, key: 'users', limitValue: maxUsers, currentValue: 1 // assuming 1 admin
         });
      }
    }

    return sub;
  }

  async getSubscription(businessId: string) {
    return db.Subscription.findOne({ where: { businessId }, include: [{ model: db.Plan }] });
  }

  async cancelSubscription(businessId: string) {
    const sub = await db.Subscription.findOne({ where: { businessId } });
    if(!sub) throw new Error("No subscription");
    await sub.update({ status: 'cancelled', cancelledAt: new Date() });
    return sub;
  }

  async createInvoice(businessId: string, data: any) {
    const sub = await db.Subscription.findOne({ where: { businessId } });
    if (!sub) throw new Error("No subscription mapped.");
    return db.SubscriptionInvoice.create({ ...data, businessId, subscriptionId: sub.id });
  }

  async recordPayment(businessId: string, invoiceId: string, data: any) {
    const inv = await db.SubscriptionInvoice.findOne({ where: { id: invoiceId, businessId } });
    if (!inv) throw new Error("Invoice not found");
    const payment = await db.SubscriptionPayment.create({ ...data, businessId, subscriptionInvoiceId: inv.id });
    if (data.status === 'confirmed') {
      await inv.update({ status: 'paid', paidAt: new Date() });
      await db.Subscription.update({ status: 'active' }, { where: { id: inv.subscriptionId } });
    }
    return payment;
  }

  async getInvoices(businessId: string) {
    return db.SubscriptionInvoice.findAll({ where: { businessId }, order: [['createdAt', 'DESC']] });
  }

  // --- Limits & Checks ---
  // A static helper designed for middlewares
  static async checkLimit(businessId: string, key: string): Promise<boolean> {
     const limit = await db.UsageLimit.findOne({ where: { businessId, key } });
     if (!limit) return true; // No explicit boundary mapped
     if (limit.limitValue === -1) return true; // Unlimited
     
     // Live mapping recalculation stub natively depending on key
     if (key === 'users') {
        const actualCount = await db.User.count({ where: { businessId, status: 'active' } });
        await limit.update({ currentValue: actualCount });
        return actualCount < limit.limitValue;
     }

     return limit.currentValue < limit.limitValue;
  }

  static async isActive(businessId: string): Promise<boolean> {
    const sub = await db.Subscription.findOne({ where: { businessId } });
    if (!sub) return true; // Gracefully permit if subsystem completely inactive / legacy
    const blockedStatuses = ['suspended', 'expired', 'past_due', 'cancelled'];
    return !blockedStatuses.includes(sub.status);
  }
}
