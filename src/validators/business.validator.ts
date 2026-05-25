import Joi from "joi";

export const createBusinessSchema = Joi.object({
  name: Joi.string().min(2).max(200).required(),
  slug: Joi.string().min(2).max(120).regex(/^[a-z0-9-]+$/).required(),
  email: Joi.string().email().max(320).required(),
  phone: Joi.string().max(50).required(),
  status: Joi.string().valid("active", "inactive").optional(),
  planId: Joi.string().uuid().required(),
  sectorFocusId: Joi.string().uuid().optional().allow(null, ""),
  settings: Joi.object().optional()
});

export const updateBusinessSchema = Joi.object({
  name: Joi.string().min(2).max(200).optional(),
  slug: Joi.string().min(2).max(120).regex(/^[a-z0-9-]+$/).optional(),
  email: Joi.string().email().max(320).optional().allow(null, ""),
  phone: Joi.string().max(50).optional().allow(null, ""),
  status: Joi.string().valid("active", "inactive").optional(),
  planId: Joi.string().uuid().optional(),
  sectorFocusId: Joi.string().uuid().optional().allow(null, ""),
  settings: Joi.object().optional()
}).min(1);
