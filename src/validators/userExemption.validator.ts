import Joi from "joi";

export const createUserExemptionSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  reason: Joi.string().trim().min(8).max(4000).required(),
  excludeFromPayroll: Joi.boolean().optional().default(false),
});

export const rejectUserExemptionSchema = Joi.object({
  reason: Joi.string().trim().max(1000).allow("", null).optional(),
});
