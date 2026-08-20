import Joi from "joi";

const accessMode = Joi.string().valid("full", "read_only", "business_admin_only", "billing_only", "locked");
const downgradePolicy = Joi.string().valid("block", "allow_with_warning", "restrict_new");

const subscriptionPolicySchema = Joi.object({
  gracePeriodDays: Joi.number().integer().min(0).max(365).allow(null),
  graceAccessMode: accessMode.allow(null),
  expiredAccessMode: accessMode.allow(null),
  retentionDays: Joi.number().integer().min(0).max(3650).allow(null),
  downgradePolicy: downgradePolicy.allow(null),
  autoRenew: Joi.boolean().allow(null),
  metadata: Joi.object().optional(),
});

const subscriptionSetupSchema = Joi.object({
  billingCycle: Joi.string().valid("monthly", "yearly").default("monthly"),
  trialDays: Joi.number().integer().min(0).max(365).default(0),
  trialEndsAt: Joi.date().allow(null),
  policy: subscriptionPolicySchema.optional(),
});

export const createBusinessSchema = Joi.object({
  name: Joi.string().min(2).max(200).required(),
  slug: Joi.string().min(2).max(120).regex(/^[a-z0-9-]+$/).required(),
  email: Joi.string().email().max(320).required(),
  phone: Joi.string().max(50).required(),
  status: Joi.string().valid("active", "inactive").optional(),
  planId: Joi.string().uuid().required(),
  sectorFocusId: Joi.string().uuid().optional().allow(null, ""),
  settings: Joi.object().optional(),
  subscription: subscriptionSetupSchema.optional(),
});

export const updateBusinessSchema = Joi.object({
  name: Joi.string().min(2).max(200).optional(),
  slug: Joi.string().min(2).max(120).regex(/^[a-z0-9-]+$/).optional(),
  email: Joi.string().email().max(320).optional().allow(null, ""),
  phone: Joi.string().max(50).optional().allow(null, ""),
  status: Joi.string().valid("active", "inactive").optional(),
  planId: Joi.string().uuid().optional(),
  sectorFocusId: Joi.string().uuid().optional().allow(null, ""),
  settings: Joi.object().optional(),
}).min(1);
