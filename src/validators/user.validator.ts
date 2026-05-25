import Joi from "joi";

export const createUserSchema = Joi.object({
  businessId: Joi.string().uuid().optional(),
  fullName: Joi.string().min(2).max(200).required(),
  email: Joi.string().email().max(320).required(),
  password: Joi.string().min(8).max(72).required(),
  phone: Joi.string().max(50).optional().allow(null, ""),
  status: Joi.string().valid("active", "inactive").optional(),
  isPlatformSuperAdmin: Joi.boolean().optional(),
  roleKeys: Joi.array().items(Joi.string().max(120)).default([])
});

export const updateUserSchema = Joi.object({
  fullName: Joi.string().min(2).max(200).optional(),
  email: Joi.string().email().max(320).optional(),
  password: Joi.string().min(8).max(72).optional(),
  phone: Joi.string().max(50).optional().allow(null, ""),
  status: Joi.string().valid("active", "inactive").optional(),
  isPlatformSuperAdmin: Joi.boolean().optional(),
  roleKeys: Joi.array().items(Joi.string().max(120)).optional()
}).min(1);

