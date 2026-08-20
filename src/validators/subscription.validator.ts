import Joi from "joi";

const uuid = Joi.string().uuid();
const accessMode = Joi.string().valid("full", "read_only", "business_admin_only", "billing_only", "locked");
const downgradePolicy = Joi.string().valid("block", "allow_with_warning", "restrict_new");
const billingCycle = Joi.string().valid("monthly", "yearly");
const limitPeriod = Joi.string().valid("daily", "monthly", "yearly", "lifetime");

export const policySchema = Joi.object({
  gracePeriodDays: Joi.number().integer().min(0).max(365).allow(null),
  graceAccessMode: accessMode.allow(null),
  expiredAccessMode: accessMode.allow(null),
  retentionDays: Joi.number().integer().min(0).max(3650).allow(null),
  downgradePolicy: downgradePolicy.allow(null),
  autoRenew: Joi.boolean().allow(null),
  metadata: Joi.object().optional(),
}).min(1);

export const assignSubscriptionSchema = Joi.object({
  planId: uuid.required(),
  billingCycle: billingCycle.default("monthly"),
  trialDays: Joi.number().integer().min(0).max(365).default(0),
  trialEndsAt: Joi.date().allow(null),
  policy: policySchema.optional(),
});

export const changePlanSchema = Joi.object({
  planId: uuid.required(),
  force: Joi.boolean().default(false),
});

export const invoiceSchema = Joi.object({
  discountAmount: Joi.number().min(0).default(0),
  taxAmount: Joi.number().min(0).default(0),
  dueDate: Joi.date(),
});

export const manualPaymentSchema = Joi.object({
  invoiceId: uuid.required(),
  amount: Joi.number().positive().required(),
  paidAt: Joi.date().optional(),
  providerReference: Joi.string().max(255).allow(null, "").optional(),
  notes: Joi.string().max(2000).allow(null, "").optional(),
});

export const extendSchema = Joi.object({
  days: Joi.number().integer().min(1).max(3650).required(),
});

export const discountSchema = Joi.object({
  discountPercent: Joi.number().min(0).max(100).required(),
});

export const usageRecordSchema = Joi.object({
  featureKey: Joi.string().max(100).required(),
  quantity: Joi.number().positive().required(),
  metadata: Joi.object().optional(),
});

export const featureOverrideSchema = Joi.object({
  isEnabled: Joi.boolean().required(),
  limitValue: Joi.number().min(0).allow(null).optional(),
  limitPeriod: limitPeriod.allow(null).optional(),
  overageUnitPrice: Joi.number().min(0).default(0),
});

export const moduleOverrideSchema = Joi.object({
  enabled: Joi.boolean().required(),
  moduleName: Joi.string().max(120).allow(null, "").optional(),
});

export const adminSchemas: Record<string, Joi.ObjectSchema> = {
  features: Joi.object({
    key: Joi.string().max(100).required(),
    name: Joi.string().max(150).required(),
    description: Joi.string().allow(null, ""),
    category: Joi.string().max(100).allow(null, ""),
    isMetered: Joi.boolean().default(false),
    unitName: Joi.string().max(50).allow(null, ""),
  }),
  "plan-features": Joi.object({
    planId: uuid.required(),
    featureId: uuid.required(),
    isEnabled: Joi.boolean().required(),
    limitValue: Joi.number().min(0).allow(null),
    limitPeriod: limitPeriod.allow(null),
    overageUnitPrice: Joi.number().min(0).default(0),
  }),
  subscriptions: Joi.object({
    businessId: uuid.required(),
    planId: uuid.required(),
    status: Joi.string().valid("pending_payment", "trialing", "active", "past_due", "suspended", "canceled", "expired").required(),
    billingCycle: billingCycle.default("monthly"),
    startDate: Joi.date(),
    currentPeriodStart: Joi.date().required(),
    currentPeriodEnd: Joi.date().required(),
    endDate: Joi.date().allow(null),
    trialEndsAt: Joi.date().allow(null),
    cancelAtPeriodEnd: Joi.boolean(),
    canceledAt: Joi.date().allow(null),
    pendingPlanId: uuid.allow(null),
    pastDueSince: Joi.date().allow(null),
    creditBalance: Joi.number().min(0).default(0),
    discountPercent: Joi.number().min(0).max(100).default(0),
    retentionUntil: Joi.date().allow(null),
    metadata: Joi.object(),
  }),
  usage: Joi.object({
    businessId: uuid.required(),
    subscriptionId: uuid.required(),
    featureId: uuid.required(),
    quantity: Joi.number().positive().required(),
    unitPrice: Joi.number().min(0).required(),
    totalPrice: Joi.number().min(0),
    usageDate: Joi.date(),
    billingPeriod: Joi.string().max(20).required(),
    metadata: Joi.object(),
  }),
  payments: Joi.object({
    invoiceId: uuid.required(),
    businessId: uuid.required(),
    amount: Joi.number().positive().required(),
    currency: Joi.string().length(3).required(),
    provider: Joi.string().max(50).required(),
    providerReference: Joi.string().max(255).allow(null, ""),
    status: Joi.string().valid("pending", "paid", "failed", "refunded"),
    paidAt: Joi.date().allow(null),
    metadata: Joi.object(),
  }),
  invoices: Joi.object({
    businessId: uuid.required(),
    subscriptionId: uuid.required(),
    invoiceNumber: Joi.string().max(100).required(),
    baseAmount: Joi.number().min(0).required(),
    seatAmount: Joi.number().min(0).required(),
    usageAmount: Joi.number().min(0).required(),
    discountAmount: Joi.number().min(0),
    taxAmount: Joi.number().min(0),
    totalAmount: Joi.number().min(0).required(),
    currency: Joi.string().length(3).required(),
    status: Joi.string().valid("draft", "issued", "paid", "failed", "void"),
    periodStart: Joi.date().required(),
    periodEnd: Joi.date().required(),
    dueDate: Joi.date().required(),
    paidAt: Joi.date().allow(null),
    metadata: Joi.object(),
  }),
};
