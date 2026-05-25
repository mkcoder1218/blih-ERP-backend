
import Joi from 'joi';
export const createPlanSchema = Joi.object({
  name: Joi.string().max(120).required(),
  key: Joi.string().max(50).required(),
  priceMonthly: Joi.number().min(0).required(),
  userLimit: Joi.number().allow(null).optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
  settings: Joi.object().optional()
});
export const updatePlanSchema = Joi.object({
  name: Joi.string().max(120).optional(),
  key: Joi.string().max(50).optional(),
  priceMonthly: Joi.number().min(0).optional(),
  userLimit: Joi.number().allow(null).optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
  settings: Joi.object().optional()
}).min(1);
