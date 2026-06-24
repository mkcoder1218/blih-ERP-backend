
import Joi from 'joi';
export const createPlanSchema = Joi.object({
  name: Joi.string().max(120).required(),
  key: Joi.string().max(50).required(),
  priceMonthly: Joi.number().min(0).default(0),
  description: Joi.string().allow(null, ''),
  basePrice: Joi.number().min(0).required(),
  billingCycle: Joi.string().valid('monthly', 'yearly').required(),
  includedSeats: Joi.number().integer().min(0).required(),
  extraSeatPrice: Joi.number().min(0).required(),
  currency: Joi.string().length(3).default('ETB'),
  isActive: Joi.boolean().default(true),
  sortOrder: Joi.number().integer().default(0),
  userLimit: Joi.number().allow(null).optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
  settings: Joi.object().optional()
});
export const updatePlanSchema = Joi.object({
  name: Joi.string().max(120).optional(),
  key: Joi.string().max(50).optional(),
  priceMonthly: Joi.number().min(0).optional(),
  description: Joi.string().allow(null, ''),
  basePrice: Joi.number().min(0),
  billingCycle: Joi.string().valid('monthly', 'yearly'),
  includedSeats: Joi.number().integer().min(0),
  extraSeatPrice: Joi.number().min(0),
  currency: Joi.string().length(3),
  isActive: Joi.boolean(),
  sortOrder: Joi.number().integer(),
  userLimit: Joi.number().allow(null).optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
  settings: Joi.object().optional()
}).min(1);
