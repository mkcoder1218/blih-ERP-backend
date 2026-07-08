import Joi from "joi";

export const specialRequestCreateSchema = Joi.object({
  requestedDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  lunchUsageType: Joi.string().valid("FULL", "PARTIAL").required(),
  requestedMinutes: Joi.number().integer().min(1).max(240).when("lunchUsageType", {
    is: "FULL",
    then: Joi.optional(),
    otherwise: Joi.required(),
  }),
  reason: Joi.string().trim().min(5).max(2000).required(),
});

export const specialRequestListSchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  size: Joi.number().integer().min(1).max(100).optional(),
  status: Joi.string().valid("all", "pending", "approved", "rejected").optional(),
  requestedDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: Joi.string().max(120).optional().allow("", null),
});

export const specialRequestRejectSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(1000).required(),
});
