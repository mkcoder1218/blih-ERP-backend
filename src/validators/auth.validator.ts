import Joi from "joi";

export const registerSchema = Joi.object({
  businessId: Joi.string().uuid().required(),
  fullName: Joi.string().min(2).max(200).required(),
  email: Joi.string().email().max(320).required(),
  password: Joi.string().min(8).max(72).required(),
  phone: Joi.string().max(50).allow(null, "").optional(),
  departmentId: Joi.string().uuid().allow(null, "").optional(),
  positionId: Joi.string().uuid().allow(null, "").optional(),
  address: Joi.string().max(500).allow(null, "").optional()
});

export const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(320).required(),
  password: Joi.string().trim().min(8).max(72).required()
});

export const selectWorkspaceSchema = Joi.object({
  businessId: Joi.string().uuid().required(),
  email: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(320).required(),
  password: Joi.string().trim().min(8).max(72).required()
});
