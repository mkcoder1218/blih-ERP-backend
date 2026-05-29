import Joi from "joi";

export const createRoleSchema = Joi.object({
  name: Joi.string().min(2).max(120).required(),
  key: Joi.string().min(2).max(120).regex(/^[A-Z0-9_]+$/).required(),
  description: Joi.string().max(255).optional().allow(null, ""),
  domain: Joi.string().max(60).optional().allow(null, ""),
  permissionKeys: Joi.array().items(Joi.string().max(170)).default([])
});

export const updateRoleSchema = Joi.object({
  name: Joi.string().min(2).max(120).optional(),
  key: Joi.string().min(2).max(120).regex(/^[A-Z0-9_]+$/).optional(),
  description: Joi.string().max(255).optional().allow(null, ""),
  domain: Joi.string().max(60).optional().allow(null, ""),
  permissionKeys: Joi.array().items(Joi.string().max(170)).optional()
}).min(1);

