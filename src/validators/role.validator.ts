import Joi from "joi";

const roleKey = Joi.string().min(2).max(120).regex(/^[A-Z0-9_]+$/);

export const createRoleSchema = Joi.object({
  name: Joi.string().min(2).max(120).required(),
  key: roleKey.required(),
  description: Joi.string().max(255).optional().allow(null, ""),
  domain: Joi.string().max(60).optional().allow(null, ""),
  businessId: Joi.string().uuid().optional(),
  copyFromRoleId: Joi.string().uuid().optional(),
  permissionKeys: Joi.array().items(Joi.string().max(170)).default([])
});

export const updateRoleSchema = Joi.object({
  name: Joi.string().min(2).max(120).optional(),
  key: roleKey.optional(),
  description: Joi.string().max(255).optional().allow(null, ""),
  domain: Joi.string().max(60).optional().allow(null, ""),
  permissionKeys: Joi.array().items(Joi.string().max(170)).optional()
}).min(1);

export const duplicateRoleSchema = Joi.object({
  name: Joi.string().min(2).max(120).required(),
  key: roleKey.required(),
  description: Joi.string().max(255).optional().allow(null, ""),
  domain: Joi.string().max(60).optional().allow(null, ""),
  businessId: Joi.string().uuid().optional(),
});
