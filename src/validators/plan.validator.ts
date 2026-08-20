import Joi from "joi";

const uuid = Joi.string().uuid();
const accessMode = Joi.string().valid("full", "read_only", "business_admin_only", "billing_only", "locked");
const downgradePolicy = Joi.string().valid("block", "allow_with_warning", "restrict_new");
const limitPeriod = Joi.string().valid("daily", "monthly", "yearly", "lifetime");

const planModuleSchema = Joi.object({
  moduleKey: Joi.string().max(120).required(),
  moduleName: Joi.string().max(120).required(),
  isEnabled: Joi.boolean().required(),
});

const planFeatureSchema = Joi.object({
  featureId: uuid.required(),
  isEnabled: Joi.boolean().required(),
  limitValue: Joi.number().min(0).allow(null),
  limitPeriod: limitPeriod.allow(null),
  overageUnitPrice: Joi.number().min(0).default(0),
});

const planPolicySchema = Joi.object({
  gracePeriodDays: Joi.number().integer().min(0).max(365).allow(null),
  graceAccessMode: accessMode.allow(null),
  expiredAccessMode: accessMode.allow(null),
  retentionDays: Joi.number().integer().min(0).max(3650).allow(null),
  downgradePolicy: downgradePolicy.allow(null),
  autoRenew: Joi.boolean().allow(null),
  metadata: Joi.object().optional(),
});

const shared = {
  name: Joi.string().max(120),
  key: Joi.string().max(50),
  priceMonthly: Joi.number().min(0),
  priceYearly: Joi.number().min(0),
  description: Joi.string().allow(null, ""),
  basePrice: Joi.number().min(0),
  billingCycle: Joi.string().valid("monthly", "yearly"),
  includedSeats: Joi.number().integer().min(0),
  extraSeatPrice: Joi.number().min(0),
  currency: Joi.string().length(3),
  isActive: Joi.boolean(),
  sortOrder: Joi.number().integer(),
  userLimit: Joi.number().integer().min(0).allow(null),
  status: Joi.string().valid("active", "inactive"),
  settings: Joi.object(),
  modules: Joi.array().items(planModuleSchema),
  features: Joi.array().items(planFeatureSchema),
  policy: planPolicySchema,
};

export const createPlanSchema = Joi.object({
  ...shared,
  name: shared.name.required(),
  key: shared.key.required(),
  priceMonthly: shared.priceMonthly.default(0),
  priceYearly: shared.priceYearly.default(0),
  basePrice: shared.basePrice.default(0),
  billingCycle: shared.billingCycle.default("monthly"),
  includedSeats: shared.includedSeats.default(0),
  extraSeatPrice: shared.extraSeatPrice.default(0),
  currency: shared.currency.default("ETB"),
  isActive: shared.isActive.default(true),
  sortOrder: shared.sortOrder.default(0),
});

export const updatePlanSchema = Joi.object(shared).min(1);
