import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Op } from "sequelize";
import { db } from "../../models";
import { TemplateService } from "../moduleTemplate/template.service";

export type SubscriptionAccessMode = "full" | "read_only" | "business_admin_only" | "billing_only" | "locked";
export type DowngradePolicy = "block" | "allow_with_warning" | "restrict_new";

export type EffectiveSubscriptionPolicy = {
  gracePeriodDays: number;
  graceAccessMode: SubscriptionAccessMode;
  expiredAccessMode: SubscriptionAccessMode;
  retentionDays: number | null;
  downgradePolicy: DowngradePolicy;
  autoRenew: boolean;
  metadata: Record<string, any>;
};

const DEFAULT_POLICY: EffectiveSubscriptionPolicy = {
  gracePeriodDays: 7,
  graceAccessMode: "read_only",
  expiredAccessMode: "billing_only",
  retentionDays: 90,
  downgradePolicy: "block",
  autoRenew: false,
  metadata: {},
};

const n = (value: unknown) => Number(value || 0);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const addCycle = (date: Date, cycle: string) => {
  const result = new Date(date);
  if (cycle === "yearly") result.setUTCFullYear(result.getUTCFullYear() + 1);
  else result.setUTCMonth(result.getUTCMonth() + 1);
  return result;
};

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

const asPlain = (row: any) => (row?.toJSON ? row.toJSON() : row);

const mergeDefined = <T extends Record<string, any>>(base: T, patch?: Record<string, any> | null): T => {
  if (!patch) return base;
  const next: Record<string, any> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== null && value !== undefined && key !== "id" && key !== "scopeKey" && key !== "scopeType" && key !== "planId" && key !== "businessId") {
      next[key] = value;
    }
  }
  return next as T;
};

export class SubscriptionService {
  private templateService = new TemplateService();

  priceForCycle(plan: any, cycle: string) {
    if (cycle === "yearly") return n(plan.priceYearly || n(plan.priceMonthly || plan.basePrice) * 12);
    return n(plan.priceMonthly || plan.basePrice);
  }

  async getActiveSubscription(businessId: string) {
    return db.Subscription.findOne({
      where: { businessId, status: { [Op.in]: ["active", "trialing"] } },
      include: [{ model: db.Plan, required: true }],
    });
  }

  async getSubscription(businessId: string) {
    return db.Subscription.findOne({
      where: { businessId },
      include: [
        { model: db.Plan },
        { model: db.SubscriptionInvoice, required: false },
      ],
    });
  }

  async resolvePolicy(businessId: string, planId?: string | null): Promise<EffectiveSubscriptionPolicy> {
    let effective: EffectiveSubscriptionPolicy = { ...DEFAULT_POLICY, metadata: {} };
    const platform = await db.SubscriptionPolicy.findOne({ where: { scopeKey: "platform" } });
    effective = mergeDefined(effective, asPlain(platform));

    if (planId) {
      const plan = await db.SubscriptionPolicy.findOne({ where: { scopeKey: `plan:${planId}` } });
      const planPlain = asPlain(plan);
      effective = mergeDefined(effective, planPlain);
      if (planPlain?.metadata) effective.metadata = { ...effective.metadata, ...planPlain.metadata };
    }

    const business = await db.SubscriptionPolicy.findOne({ where: { scopeKey: `business:${businessId}` } });
    const businessPlain = asPlain(business);
    effective = mergeDefined(effective, businessPlain);
    if (businessPlain?.metadata) effective.metadata = { ...effective.metadata, ...businessPlain.metadata };

    effective.gracePeriodDays = Math.max(0, n(effective.gracePeriodDays));
    effective.retentionDays = effective.retentionDays == null ? null : Math.max(0, n(effective.retentionDays));
    return effective;
  }

  async getPolicyLayers(businessId?: string, planId?: string) {
    const rows: Record<string, any> = {
      platform: await db.SubscriptionPolicy.findOne({ where: { scopeKey: "platform" } }),
      plan: planId ? await db.SubscriptionPolicy.findOne({ where: { scopeKey: `plan:${planId}` } }) : null,
      business: businessId ? await db.SubscriptionPolicy.findOne({ where: { scopeKey: `business:${businessId}` } }) : null,
    };
    rows.effective = businessId ? await this.resolvePolicy(businessId, planId) : mergeDefined({ ...DEFAULT_POLICY }, asPlain(rows.platform));
    return rows;
  }

  async upsertPolicy(scopeType: "platform" | "plan" | "business", scopeId: string | null, patch: any) {
    const scopeKey = scopeType === "platform" ? "platform" : `${scopeType}:${scopeId}`;
    const [row] = await db.SubscriptionPolicy.findOrCreate({
      where: { scopeKey },
      defaults: {
        scopeKey,
        scopeType,
        planId: scopeType === "plan" ? scopeId : null,
        businessId: scopeType === "business" ? scopeId : null,
      },
    });
    await row.update({
      ...patch,
      scopeType,
      planId: scopeType === "plan" ? scopeId : null,
      businessId: scopeType === "business" ? scopeId : null,
    });
    return row;
  }

  async ensureSubscriptionForBusiness(
    businessId: string,
    planId: string,
    options: {
      billingCycle?: "monthly" | "yearly";
      trialDays?: number;
      trialEndsAt?: string | Date | null;
      policy?: any;
    } = {},
  ) {
    const existing = await db.Subscription.findOne({ where: { businessId } });
    if (existing) return existing;
    const plan = await db.Plan.findByPk(planId);
    if (!plan || !plan.isActive) throw new Error("An active plan is required to create a subscription.");

    const now = new Date();
    const billingCycle = options.billingCycle || "monthly";
    const trialDays = Math.max(0, n(options.trialDays));
    const explicitTrialEnd = options.trialEndsAt ? new Date(options.trialEndsAt) : null;
    const trialEndsAt = explicitTrialEnd && explicitTrialEnd > now ? explicitTrialEnd : trialDays > 0 ? addDays(now, trialDays) : null;
    const status = trialEndsAt ? "trialing" : "pending_payment";
    const currentPeriodEnd = trialEndsAt || addCycle(now, billingCycle);

    const subscription = await db.Subscription.create({
      businessId,
      planId,
      status,
      billingCycle,
      startDate: now,
      currentPeriodStart: now,
      currentPeriodEnd,
      trialEndsAt,
      metadata: {},
    });

    await db.Business.update({ planId }, { where: { id: businessId } });
    if (options.policy) await this.upsertPolicy("business", businessId, options.policy);
    await this.syncBusinessEntitlements(businessId, planId);

    if (status === "pending_payment") {
      await this.createInvoiceForSubscription(subscription, {
        type: "initial",
        periodStart: now,
        periodEnd: currentPeriodEnd,
        includeUsage: false,
        includeSeats: false,
        dueDate: now,
      });
    }

    return subscription.reload({ include: [{ model: db.Plan }] });
  }

  private subscriptionMetadata(subscription: any) {
    const metadata = asPlain(subscription)?.metadata;
    return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
  }

  async syncBusinessEntitlements(businessId: string, planId?: string) {
    const subscription = await db.Subscription.findOne({ where: { businessId } });
    const effectivePlanId = planId || subscription?.planId;
    if (!effectivePlanId) return [];

    const metadata = this.subscriptionMetadata(subscription);
    const moduleOverrides = metadata.moduleOverrides || {};
    const planModules = await db.PlanModule.findAll({ where: { planId: effectivePlanId } });
    const desired = new Map<string, { moduleName: string; enabled: boolean }>();

    for (const row of planModules) {
      desired.set(row.moduleKey, { moduleName: row.moduleName, enabled: Boolean(row.isEnabled) });
    }
    for (const [moduleKey, override] of Object.entries<any>(moduleOverrides)) {
      const existing = desired.get(moduleKey);
      desired.set(moduleKey, {
        moduleName: override.moduleName || existing?.moduleName || moduleKey,
        enabled: override.enabled ?? existing?.enabled ?? false,
      });
    }

    const current = await db.BusinessModule.findAll({ where: { businessId } });
    const currentByKey = new Map<string, any>(current.map((row: any) => [String(row.moduleKey), row] as [string, any]));
    const now = new Date();

    for (const [moduleKey, entry] of desired) {
      const existing = currentByKey.get(moduleKey);
      if (!existing) {
        const created = await db.BusinessModule.create({
          businessId,
          moduleKey,
          moduleName: entry.moduleName,
          status: entry.enabled ? "active" : "inactive",
          enabledAt: entry.enabled ? now : null,
          disabledAt: entry.enabled ? null : now,
        });
        currentByKey.set(moduleKey, created);
        if (entry.enabled) {
          try {
            await this.templateService.applyTemplate(businessId, moduleKey, false);
          } catch (error) {
            console.warn(`Failed to apply template for subscription module ${moduleKey}:`, error);
          }
        }
        continue;
      }

      const wasActive = existing.status === "active";
      await existing.update({
        moduleName: entry.moduleName,
        status: entry.enabled ? "active" : "inactive",
        enabledAt: entry.enabled ? existing.enabledAt || now : existing.enabledAt,
        disabledAt: entry.enabled ? null : now,
      });
      if (entry.enabled && !wasActive) {
        try {
          await this.templateService.applyTemplate(businessId, moduleKey, false);
        } catch (error) {
          console.warn(`Failed to apply template for re-enabled subscription module ${moduleKey}:`, error);
        }
      }
    }

    for (const row of current) {
      if (!desired.has(row.moduleKey) && row.status !== "inactive") {
        await row.update({ status: "inactive", disabledAt: now });
      }
    }

    return db.BusinessModule.findAll({ where: { businessId }, order: [["moduleName", "ASC"]] });
  }

  async applyPlan(businessId: string, planId: string, extraPatch: Record<string, any> = {}) {
    const subscription = await db.Subscription.findOne({ where: { businessId } });
    const target = await db.Plan.findByPk(planId);
    if (!subscription || !target || !target.isActive) throw new Error("Subscription or active target plan not found.");
    await subscription.update({ planId, pendingPlanId: null, ...extraPatch });
    await db.Business.update({ planId }, { where: { id: businessId } });
    await this.syncBusinessEntitlements(businessId, planId);
    return subscription.reload({ include: [{ model: db.Plan }] });
  }

  async getFeatures(businessId: string) {
    const subscription = await db.Subscription.findOne({ where: { businessId } });
    if (!subscription) return [];
    const rows = await db.PlanFeature.findAll({
      where: { planId: subscription.planId },
      include: [{ model: db.Feature, as: "feature" }],
    });
    const metadata = this.subscriptionMetadata(subscription);
    const overrides = metadata.featureOverrides || {};
    const result: any[] = rows.map((row: any) => {
      const plain = asPlain(row);
      const override = overrides[plain.featureId] || overrides[plain.feature?.key] || {};
      return { ...plain, ...override, feature: plain.feature };
    });

    const represented = new Set(result.map((row) => row.featureId));
    for (const [key, override] of Object.entries<any>(overrides)) {
      if (represented.has(key)) continue;
      const feature = await db.Feature.findOne({ where: { [Op.or]: [{ id: key }, { key }] } });
      if (!feature || represented.has(feature.id)) continue;
      result.push({
        id: `override:${feature.id}`,
        planId: subscription.planId,
        featureId: feature.id,
        isEnabled: false,
        limitValue: null,
        limitPeriod: null,
        overageUnitPrice: 0,
        ...override,
        feature: asPlain(feature),
      });
      represented.add(feature.id);
    }
    return result;
  }

  async getEntitlement(businessId: string, featureKey: string) {
    const subscription = await db.Subscription.findOne({ where: { businessId } });
    if (!subscription) return null;
    const rows = await this.getFeatures(businessId);
    const planFeature = rows.find((row: any) => row.feature?.key === featureKey);
    if (!planFeature?.isEnabled) return null;
    return { subscription, feature: planFeature.feature, planFeature };
  }

  async canUseFeature(businessId: string, featureKey: string, requestedQuantity = 1) {
    const result = await this.checkFeatureLimit(businessId, featureKey, requestedQuantity);
    return result.allowed;
  }

  async checkFeatureLimit(businessId: string, featureKey: string, requestedQuantity = 1) {
    const entitlement = await this.getEntitlement(businessId, featureKey);
    if (!entitlement) return { allowed: false, message: "Feature is not enabled for the current plan." };
    const { subscription, feature, planFeature } = entitlement;
    if (planFeature.limitValue == null) return { allowed: true, used: 0, limit: null, overageQuantity: 0 };

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
    const projected = used + n(requestedQuantity);
    const overageQuantity = Math.max(0, projected - limit);
    const overageUnitPrice = n(planFeature.overageUnitPrice);
    const meteredOverage = Boolean(feature.isMetered) && overageUnitPrice > 0;
    const allowed = projected <= limit || meteredOverage;
    return {
      allowed,
      used,
      limit,
      projected,
      overageQuantity,
      overageUnitPrice,
      message: allowed ? undefined : `${feature.name} limit exceeded (${projected}/${limit}).`,
    };
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

  async recordUsage(businessId: string, featureKey: string, quantity: number, metadata: any = {}) {
    const entitlement = await this.getEntitlement(businessId, featureKey);
    if (!entitlement) throw new Error("Feature is not enabled for the current plan.");
    const check = await this.checkFeatureLimit(businessId, featureKey, quantity);
    if (!check.allowed) throw new Error(check.message);
    const overageQuantity = n(check.overageQuantity);
    const unitPrice = overageQuantity > 0 ? n(check.overageUnitPrice) : 0;
    const totalPrice = overageQuantity * unitPrice;
    return db.UsageRecord.create({
      businessId,
      subscriptionId: entitlement.subscription.id,
      featureId: entitlement.feature.id,
      quantity,
      unitPrice,
      totalPrice,
      usageDate: new Date(),
      billingPeriod: entitlement.subscription.billingCycle,
      metadata,
    });
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
      where: { subscriptionId, usageDate: { [Op.gte]: periodStart, [Op.lt]: periodEnd } },
    }));
  }

  private async createInvoiceForSubscription(
    subscription: any,
    options: {
      type?: string;
      periodStart?: Date;
      periodEnd?: Date;
      dueDate?: Date;
      includeSeats?: boolean;
      includeUsage?: boolean;
      baseAmount?: number;
      discountAmount?: number;
      taxAmount?: number;
      metadata?: Record<string, any>;
    } = {},
  ) {
    const plan = await db.Plan.findByPk(subscription.planId);
    if (!plan) throw new Error("Plan not found.");
    const periodStart = options.periodStart || new Date(subscription.currentPeriodStart);
    const periodEnd = options.periodEnd || new Date(subscription.currentPeriodEnd);
    const seat = options.includeSeats === false ? { seatAmount: 0 } : await this.calculateSeatCharge(subscription.businessId, subscription.planId);
    const usageAmount = options.includeUsage === false ? 0 : await this.calculateUsageCharge(subscription.id, periodStart, periodEnd);
    const baseAmount = options.baseAmount ?? this.priceForCycle(plan, subscription.billingCycle);
    const beforeDiscount = Math.max(0, baseAmount + n(seat.seatAmount) + usageAmount);
    const subscriptionDiscount = beforeDiscount * clamp(n(subscription.discountPercent), 0, 100) / 100;
    const discountAmount = options.discountAmount ?? subscriptionDiscount;
    const taxAmount = n(options.taxAmount);
    const afterDiscount = Math.max(0, beforeDiscount - discountAmount + taxAmount);
    const creditBalance = n(subscription.creditBalance);
    const creditApplied = Math.min(creditBalance, afterDiscount);
    const totalAmount = Math.max(0, afterDiscount - creditApplied);
    const invoiceNumber = `SUB-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    const invoice = await db.SubscriptionInvoice.create({
      businessId: subscription.businessId,
      subscriptionId: subscription.id,
      invoiceNumber,
      baseAmount,
      seatAmount: n(seat.seatAmount),
      usageAmount,
      discountAmount,
      taxAmount,
      totalAmount,
      currency: plan.currency,
      status: totalAmount === 0 ? "paid" : "issued",
      periodStart,
      periodEnd,
      dueDate: options.dueDate || periodEnd,
      paidAt: totalAmount === 0 ? new Date() : null,
      metadata: {
        type: options.type || "manual",
        creditApplied,
        ...options.metadata,
      },
    });

    if (creditApplied > 0) await subscription.update({ creditBalance: creditBalance - creditApplied });
    if (totalAmount === 0) await this.handlePaidInvoice(invoice);
    return invoice;
  }

  async generateInvoice(subscriptionId: string, adjustments: { discountAmount?: number; taxAmount?: number; dueDate?: Date } = {}) {
    const subscription = await db.Subscription.findByPk(subscriptionId);
    if (!subscription) throw new Error("Subscription not found.");
    return this.createInvoiceForSubscription(subscription, adjustments);
  }

  async changePlan(businessId: string, planId: string, force = false) {
    const subscription = await db.Subscription.findOne({ where: { businessId } });
    const target = await db.Plan.findByPk(planId);
    if (!subscription || !target || !target.isActive) throw new Error("Subscription or active target plan not found.");
    if (subscription.planId === planId && !subscription.pendingPlanId) {
      return { subscription: await subscription.reload({ include: [{ model: db.Plan }] }), adjustment: null, warnings: [] };
    }

    const current = await db.Plan.findByPk(subscription.planId);
    if (!current) throw new Error("Current plan not found.");
    const policy = await this.resolvePolicy(businessId, subscription.planId);
    const issues = await this.validatePlanLimits(businessId, planId);
    const currentPrice = this.priceForCycle(current, subscription.billingCycle);
    const targetPrice = this.priceForCycle(target, subscription.billingCycle);
    const now = new Date();
    const periodStart = new Date(subscription.currentPeriodStart);
    const periodEnd = new Date(subscription.currentPeriodEnd);
    const totalMs = Math.max(1, periodEnd.getTime() - periodStart.getTime());
    const remainingMs = Math.max(0, periodEnd.getTime() - now.getTime());
    const remainingFraction = clamp(remainingMs / totalMs, 0, 1);
    const proratedDifference = Math.round((targetPrice - currentPrice) * remainingFraction * 100) / 100;

    if (proratedDifference < 0) {
      if (issues.length && policy.downgradePolicy === "block" && !force) {
        throw new Error(issues.join(" "));
      }
      const credit = Math.abs(proratedDifference);
      const metadata = this.subscriptionMetadata(subscription);
      await subscription.update({
        creditBalance: n(subscription.creditBalance) + credit,
        metadata: {
          ...metadata,
          lastPlanChange: { fromPlanId: current.id, toPlanId: target.id, type: "downgrade", credit, at: now.toISOString(), issues },
        },
      });
      const updated = await this.applyPlan(businessId, planId);
      return {
        subscription: updated,
        adjustment: { type: "credit", amount: credit, currency: target.currency, remainingFraction },
        warnings: issues,
      };
    }

    if (proratedDifference > 0 && !force) {
      await subscription.update({ pendingPlanId: planId });
      const invoice = await this.createInvoiceForSubscription(subscription, {
        type: "plan_change",
        periodStart: now,
        periodEnd,
        dueDate: now,
        includeSeats: false,
        includeUsage: false,
        baseAmount: proratedDifference,
        metadata: {
          targetPlanId: planId,
          fromPlanId: current.id,
          remainingFraction,
          proratedDifference,
        },
      });
      return {
        subscription: await subscription.reload({ include: [{ model: db.Plan }] }),
        adjustment: { type: "invoice", amount: n(invoice.totalAmount), invoice, remainingFraction },
        warnings: issues,
      };
    }

    const updated = await this.applyPlan(businessId, planId, { status: subscription.status === "pending_payment" ? "pending_payment" : "active" });
    return { subscription: updated, adjustment: proratedDifference > 0 ? { type: "admin_override", amount: proratedDifference } : null, warnings: issues };
  }

  async validatePlanLimits(businessId: string, planId: string) {
    const issues: string[] = [];
    const employee = await db.Feature.findOne({ where: { key: "employee_limit" } });
    if (employee) {
      const entitlement = await db.PlanFeature.findOne({ where: { planId, featureId: employee.id, isEnabled: true } });
      if (entitlement?.limitValue != null) {
        const count = await db.User.count({ where: { businessId, status: "active" } });
        if (count > n(entitlement.limitValue)) {
          const plan = await db.Plan.findByPk(planId);
          issues.push(`You currently have ${count} active employees, but ${plan.name} allows ${n(entitlement.limitValue)}.`);
        }
      }
    }
    return issues;
  }

  async cancel(businessId: string) {
    const subscription = await db.Subscription.findOne({ where: { businessId } });
    if (!subscription) throw new Error("No subscription found.");
    return subscription.update({ cancelAtPeriodEnd: true, canceledAt: new Date() });
  }

  async reactivate(businessId: string) {
    const subscription = await db.Subscription.findOne({ where: { businessId } });
    if (!subscription) throw new Error("No subscription found.");
    if (["expired", "suspended"].includes(subscription.status)) throw new Error("Please contact the platform administrator to reactivate this subscription.");
    return subscription.update({ cancelAtPeriodEnd: false, canceledAt: null });
  }

  async getUsage(businessId: string) {
    return db.UsageRecord.findAll({
      where: { businessId },
      include: [{ model: db.Feature, as: "feature" }],
      order: [["usageDate", "DESC"]],
    });
  }

  async getPayments(businessId: string) {
    return db.SubscriptionPayment.findAll({ where: { businessId }, order: [["paidAt", "DESC"], ["createdAt", "DESC"]] });
  }

  async getInvoices(businessId: string) {
    const invoices = await db.SubscriptionInvoice.findAll({ where: { businessId }, order: [["createdAt", "DESC"]] });
    if (!invoices.length) return [];
    const payments = await db.SubscriptionPayment.findAll({
      where: { businessId, invoiceId: { [Op.in]: invoices.map((invoice: any) => invoice.id) }, status: "paid" },
    });
    const paidByInvoice = new Map<string, number>();
    for (const payment of payments) {
      paidByInvoice.set(payment.invoiceId, n(paidByInvoice.get(payment.invoiceId)) + n(payment.amount));
    }
    return invoices.map((invoice: any) => {
      const plain = asPlain(invoice);
      const amountPaid = paidByInvoice.get(invoice.id) || (invoice.status === "paid" ? n(invoice.totalAmount) : 0);
      return { ...plain, amountPaid, outstandingAmount: Math.max(0, n(invoice.totalAmount) - amountPaid) };
    });
  }

  async recordManualPayment(
    businessId: string,
    invoiceId: string,
    input: { amount: number; paidAt?: string | Date; providerReference?: string | null; notes?: string | null },
    receipt?: { buffer: Buffer; originalname: string; mimetype: string } | null,
  ) {
    const invoice = await db.SubscriptionInvoice.findOne({ where: { id: invoiceId, businessId } });
    if (!invoice) throw new Error("Invoice not found.");
    if (invoice.status === "void") throw new Error("A void invoice cannot receive payments.");
    if (n(input.amount) <= 0) throw new Error("Payment amount must be greater than zero.");

    let receiptMetadata: any = {};
    if (receipt) {
      const directory = path.join(process.cwd(), "uploads", "subscription-receipts", businessId);
      fs.mkdirSync(directory, { recursive: true });
      const ext = path.extname(receipt.originalname) || (receipt.mimetype === "application/pdf" ? ".pdf" : ".bin");
      const filename = `${crypto.randomUUID()}${ext}`;
      const storagePath = path.join(directory, filename);
      fs.writeFileSync(storagePath, receipt.buffer);
      receiptMetadata = {
        receiptPath: storagePath,
        receiptOriginalName: receipt.originalname,
        receiptMimeType: receipt.mimetype,
      };
    }

    const payment = await db.SubscriptionPayment.create({
      businessId,
      invoiceId,
      amount: n(input.amount),
      currency: invoice.currency,
      provider: "manual",
      providerReference: input.providerReference || null,
      paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
      status: "paid",
      metadata: { notes: input.notes || null, ...receiptMetadata },
    });

    const totalPaid = n(await db.SubscriptionPayment.sum("amount", { where: { invoiceId, status: "paid" } }));
    if (totalPaid + 0.0001 >= n(invoice.totalAmount)) {
      await invoice.update({ status: "paid", paidAt: payment.paidAt || new Date() });
      await this.handlePaidInvoice(invoice);
    }

    return { payment, invoice: await invoice.reload(), totalPaid, outstandingAmount: Math.max(0, n(invoice.totalAmount) - totalPaid) };
  }

  private async handlePaidInvoice(invoice: any) {
    const subscription = await db.Subscription.findByPk(invoice.subscriptionId);
    if (!subscription) return;
    const metadata = asPlain(invoice).metadata || {};
    const type = metadata.type || "manual";

    if (type === "plan_change" && metadata.targetPlanId) {
      await this.applyPlan(subscription.businessId, metadata.targetPlanId, { pendingPlanId: null });
      return;
    }

    if (type === "initial" || subscription.status === "pending_payment") {
      const now = new Date();
      await subscription.update({
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: addCycle(now, subscription.billingCycle),
        pastDueSince: null,
        endDate: null,
        retentionUntil: null,
      });
      await this.syncBusinessEntitlements(subscription.businessId, subscription.planId);
      return;
    }

    if (type === "renewal" || subscription.status === "past_due" || subscription.status === "expired") {
      const start = new Date(invoice.periodEnd);
      const now = new Date();
      const periodStart = start > now ? start : now;
      await subscription.update({
        status: "active",
        currentPeriodStart: periodStart,
        currentPeriodEnd: addCycle(periodStart, subscription.billingCycle),
        pastDueSince: null,
        endDate: null,
        retentionUntil: null,
        cancelAtPeriodEnd: false,
        canceledAt: null,
      });
      await this.syncBusinessEntitlements(subscription.businessId, subscription.planId);
    }
  }

  async extendSubscription(businessId: string, days: number) {
    const subscription = await db.Subscription.findOne({ where: { businessId } });
    if (!subscription) throw new Error("Subscription not found.");
    const base = new Date(subscription.currentPeriodEnd || new Date());
    return subscription.update({ currentPeriodEnd: addDays(base, Math.max(1, days)) });
  }

  async setDiscount(businessId: string, discountPercent: number) {
    const subscription = await db.Subscription.findOne({ where: { businessId } });
    if (!subscription) throw new Error("Subscription not found.");
    return subscription.update({ discountPercent: clamp(n(discountPercent), 0, 100) });
  }

  async suspend(businessId: string) {
    const subscription = await db.Subscription.findOne({ where: { businessId } });
    if (!subscription) throw new Error("Subscription not found.");
    return subscription.update({ status: "suspended" });
  }

  async adminReactivate(businessId: string) {
    const subscription = await db.Subscription.findOne({ where: { businessId } });
    if (!subscription) throw new Error("Subscription not found.");
    const now = new Date();
    const periodEnd = subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd) > now
      ? new Date(subscription.currentPeriodEnd)
      : addCycle(now, subscription.billingCycle);
    await subscription.update({
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      pastDueSince: null,
      endDate: null,
      retentionUntil: null,
      cancelAtPeriodEnd: false,
      canceledAt: null,
    });
    await this.syncBusinessEntitlements(businessId, subscription.planId);
    return subscription;
  }

  async setFeatureOverride(businessId: string, featureId: string, override: any | null) {
    const subscription = await db.Subscription.findOne({ where: { businessId } });
    if (!subscription) throw new Error("Subscription not found.");
    const feature = await db.Feature.findByPk(featureId);
    if (!feature) throw new Error("Feature not found.");
    const metadata = this.subscriptionMetadata(subscription);
    const featureOverrides = { ...(metadata.featureOverrides || {}) };
    if (override === null) delete featureOverrides[featureId];
    else featureOverrides[featureId] = {
      isEnabled: override.isEnabled,
      limitValue: override.limitValue ?? null,
      limitPeriod: override.limitPeriod ?? null,
      overageUnitPrice: override.overageUnitPrice ?? 0,
    };
    await subscription.update({ metadata: { ...metadata, featureOverrides } });
    return this.getFeatures(businessId);
  }

  async setModuleOverride(businessId: string, moduleKey: string, override: any | null) {
    const subscription = await db.Subscription.findOne({ where: { businessId } });
    if (!subscription) throw new Error("Subscription not found.");
    const metadata = this.subscriptionMetadata(subscription);
    const moduleOverrides = { ...(metadata.moduleOverrides || {}) };
    if (override === null) delete moduleOverrides[moduleKey];
    else moduleOverrides[moduleKey] = { enabled: Boolean(override.enabled), moduleName: override.moduleName || moduleKey };
    await subscription.update({ metadata: { ...metadata, moduleOverrides } });
    await this.syncBusinessEntitlements(businessId, subscription.planId);
    return db.BusinessModule.findAll({ where: { businessId }, order: [["moduleName", "ASC"]] });
  }

  async getAdminOverview() {
    const [active, trialing, pastDue, pendingPayment, suspended, canceled, expired] = await Promise.all([
      db.Subscription.count({ where: { status: "active" } }),
      db.Subscription.count({ where: { status: "trialing" } }),
      db.Subscription.count({ where: { status: "past_due" } }),
      db.Subscription.count({ where: { status: "pending_payment" } }),
      db.Subscription.count({ where: { status: "suspended" } }),
      db.Subscription.count({ where: { status: "canceled" } }),
      db.Subscription.count({ where: { status: "expired" } }),
    ]);
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    const monthlyRevenue = n(await db.SubscriptionPayment.sum("amount", {
      where: { status: "paid", paidAt: { [Op.gte]: startOfMonth } },
    }));
    const issued = await db.SubscriptionInvoice.findAll({ where: { status: "issued" } });
    let outstanding = 0;
    for (const invoice of issued) {
      const paid = n(await db.SubscriptionPayment.sum("amount", { where: { invoiceId: invoice.id, status: "paid" } }));
      outstanding += Math.max(0, n(invoice.totalAmount) - paid);
    }
    return { active, trialing, pastDue, pendingPayment, suspended, canceled, expired, monthlyRevenue, outstanding };
  }

  async listAdminBusinesses() {
    const businesses = await db.Business.findAll({ order: [["name", "ASC"]] });
    const result: any[] = [];
    for (const business of businesses) {
      const subscription = await db.Subscription.findOne({ where: { businessId: business.id }, include: [{ model: db.Plan }] });
      if (!subscription) {
        result.push({ business: asPlain(business), subscription: null, outstandingAmount: 0, lastPayment: null });
        continue;
      }
      const invoices = await this.getInvoices(business.id);
      const payments = await this.getPayments(business.id);
      result.push({
        business: asPlain(business),
        subscription: asPlain(subscription),
        outstandingAmount: invoices.reduce((sum: number, invoice: any) => sum + n(invoice.outstandingAmount), 0),
        lastPayment: payments[0] ? asPlain(payments[0]) : null,
      });
    }
    return result;
  }

  async getAdminBusinessDetail(businessId: string) {
    const business = await db.Business.findByPk(businessId);
    if (!business) throw new Error("Business not found.");
    const subscription = await db.Subscription.findOne({ where: { businessId }, include: [{ model: db.Plan }] });
    const plans = await db.Plan.findAll({ where: { isActive: true }, order: [["sortOrder", "ASC"], ["name", "ASC"]] });
    if (!subscription) return { business, subscription: null, plans, policy: await this.getPolicyLayers(businessId, business.planId), invoices: [], payments: [], usage: [], features: [], modules: [] };
    const [policy, invoices, payments, usage, features, modules] = await Promise.all([
      this.getPolicyLayers(businessId, subscription.planId),
      this.getInvoices(businessId),
      this.getPayments(businessId),
      this.getUsage(businessId),
      this.getFeatures(businessId),
      db.BusinessModule.findAll({ where: { businessId }, order: [["moduleName", "ASC"]] }),
    ]);
    return { business, subscription, plans, policy, invoices, payments, usage, features, modules };
  }

  async assignSubscription(businessId: string, planId: string, options: any = {}) {
    const existing = await db.Subscription.findOne({ where: { businessId } });
    if (existing) throw new Error("This business already has a subscription.");
    return this.ensureSubscriptionForBusiness(businessId, planId, options);
  }

  async getReceiptFile(paymentId: string, businessId?: string) {
    const where: any = { id: paymentId };
    if (businessId) where.businessId = businessId;
    const payment = await db.SubscriptionPayment.findOne({ where });
    if (!payment) return null;
    const metadata = asPlain(payment).metadata || {};
    if (!metadata.receiptPath || !fs.existsSync(metadata.receiptPath)) return null;
    return {
      path: metadata.receiptPath,
      name: metadata.receiptOriginalName || `payment-${payment.id}`,
      mimeType: metadata.receiptMimeType || "application/octet-stream",
    };
  }

  async evaluateAccess(businessId: string, method = "GET", roles: string[] = []) {
    const subscription = await db.Subscription.findOne({ where: { businessId } });
    // Preserve access for historical businesses until a subscription is explicitly assigned.
    if (!subscription) return { allowed: true, mode: "full" as SubscriptionAccessMode, status: "legacy_unassigned", reason: "No subscription has been assigned yet." };

    const policy = await this.resolvePolicy(businessId, subscription.planId);
    let mode: SubscriptionAccessMode = "locked";
    let graceEndsAt: Date | null = null;

    if (["active", "trialing"].includes(subscription.status)) mode = "full";
    else if (subscription.status === "pending_payment") mode = "billing_only";
    else if (subscription.status === "past_due") {
      const since = new Date(subscription.pastDueSince || subscription.currentPeriodEnd || new Date());
      graceEndsAt = addDays(since, policy.gracePeriodDays);
      mode = new Date() <= graceEndsAt ? policy.graceAccessMode : policy.expiredAccessMode;
    } else if (["canceled", "expired"].includes(subscription.status)) mode = policy.expiredAccessMode;
    else if (subscription.status === "suspended") mode = "locked";

    const normalizedMethod = method.toUpperCase();
    let allowed = false;
    if (mode === "full") allowed = true;
    else if (mode === "read_only") allowed = ["GET", "HEAD", "OPTIONS"].includes(normalizedMethod);
    else if (mode === "business_admin_only") allowed = roles.includes("BUSINESS_ADMIN");
    else if (mode === "billing_only") allowed = false;
    else allowed = false;

    return { allowed, mode, status: subscription.status, graceEndsAt, policy, subscription };
  }

  async processLifecycle(now = new Date()) {
    const subscriptions = await db.Subscription.findAll({
      where: { status: { [Op.in]: ["trialing", "active", "past_due", "canceled", "expired"] } },
    });
    const result = { trialEnded: 0, pastDue: 0, canceled: 0, expired: 0, retentionElapsed: 0 };

    for (const subscription of subscriptions) {
      if (subscription.status === "trialing" && subscription.trialEndsAt && new Date(subscription.trialEndsAt) <= now) {
        const periodEnd = addCycle(now, subscription.billingCycle);
        await subscription.update({
          status: "pending_payment",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        });
        const existingInvoice = await db.SubscriptionInvoice.findOne({ where: { subscriptionId: subscription.id, status: { [Op.ne]: "void" } }, order: [["createdAt", "DESC"]] });
        if (!existingInvoice) {
          const invoice = await this.createInvoiceForSubscription(subscription, {
            type: "initial",
            periodStart: now,
            periodEnd,
            dueDate: now,
            includeUsage: false,
            includeSeats: false,
          });
          if (invoice.status === "paid") {
            result.trialEnded += 1;
            continue;
          }
        }
        result.trialEnded += 1;
        continue;
      }

      if (subscription.status === "active" && new Date(subscription.currentPeriodEnd) <= now) {
        if (subscription.cancelAtPeriodEnd) {
          const policy = await this.resolvePolicy(subscription.businessId, subscription.planId);
          const retentionUntil = policy.retentionDays == null ? null : addDays(now, policy.retentionDays);
          await subscription.update({ status: "canceled", endDate: now, retentionUntil });
          result.canceled += 1;
          continue;
        }

        const existingInvoice = await db.SubscriptionInvoice.findOne({
          where: {
            subscriptionId: subscription.id,
            periodStart: subscription.currentPeriodStart,
            periodEnd: subscription.currentPeriodEnd,
            status: { [Op.ne]: "void" },
          },
        });
        if (!existingInvoice) {
          const invoice = await this.createInvoiceForSubscription(subscription, {
            type: "renewal",
            periodStart: new Date(subscription.currentPeriodStart),
            periodEnd: new Date(subscription.currentPeriodEnd),
            dueDate: new Date(subscription.currentPeriodEnd),
          });
          if (invoice.status === "paid") continue;
        } else if (existingInvoice.status === "paid") {
          await this.handlePaidInvoice(existingInvoice);
          continue;
        }
        await subscription.update({ status: "past_due", pastDueSince: new Date(subscription.currentPeriodEnd) });
        result.pastDue += 1;
        continue;
      }

      if (subscription.status === "past_due") {
        const policy = await this.resolvePolicy(subscription.businessId, subscription.planId);
        const since = new Date(subscription.pastDueSince || subscription.currentPeriodEnd || now);
        const graceEnd = addDays(since, policy.gracePeriodDays);
        if (now > graceEnd) {
          const retentionUntil = policy.retentionDays == null ? null : addDays(now, policy.retentionDays);
          await subscription.update({ status: "expired", endDate: now, retentionUntil });
          result.expired += 1;
        }
        continue;
      }

      if (["canceled", "expired"].includes(subscription.status) && subscription.retentionUntil && new Date(subscription.retentionUntil) <= now) {
        const metadata = this.subscriptionMetadata(subscription);
        if (!metadata.retentionElapsedAt) {
          await subscription.update({ metadata: { ...metadata, retentionElapsedAt: now.toISOString() } });
          result.retentionElapsed += 1;
        }
      }
    }

    return result;
  }

  static async isActive(businessId: string) {
    return Boolean(await db.Subscription.findOne({ where: { businessId, status: { [Op.in]: ["active", "trialing"] } } }));
  }
}
