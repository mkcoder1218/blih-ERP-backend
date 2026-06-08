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

// Public self-registration — uses slug instead of businessId
export const publicRegisterSchema = Joi.object({
  businessSlug:          Joi.string().min(2).max(100).required(),
  fullName:              Joi.string().min(2).max(200).required(),
  email:                 Joi.string().email().max(320).required(),
  password:              Joi.string().min(8).max(72).required(),
  phone:                 Joi.string().max(50).allow(null, '').optional(),
  dateOfBirth:           Joi.string().allow(null, '').optional(),
  nationalId:            Joi.string().max(100).allow(null, '').optional(), // ID number (optional alongside document)
  address:               Joi.string().max(500).allow(null, '').optional(),
  city:                  Joi.string().max(100).allow(null, '').optional(),
  country:               Joi.string().max(100).allow(null, '').optional(),
  requestedRoleKey:      Joi.string().max(50).allow(null, '').optional(),
  employmentType:        Joi.string().max(50).allow(null, '').optional(),
  hireDate:              Joi.string().allow(null, '').optional(),
  departmentId:          Joi.string().uuid().allow(null, '').optional(),
  emergencyName:         Joi.string().max(200).allow(null, '').optional(),
  emergencyPhone:        Joi.string().max(50).allow(null, '').optional(),
  emergencyRelationship: Joi.string().max(100).allow(null, '').optional(),
  bankName:              Joi.string().max(200).allow(null, '').optional(),
  bankAccount:           Joi.string().max(100).allow(null, '').optional(),
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
