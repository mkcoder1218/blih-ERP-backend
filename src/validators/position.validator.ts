
import Joi from 'joi';
export const createPositionSchema = Joi.object({
  departmentId: Joi.string().uuid().required(),
  title: Joi.string().max(120).required(),
  key: Joi.string().max(120).optional(),
  level: Joi.number().min(1).optional(),
  description: Joi.string().allow(null, '').optional(),
  status: Joi.string().valid('active', 'inactive').optional()
});
export const updatePositionSchema = Joi.object({
  departmentId: Joi.string().uuid().optional(),
  title: Joi.string().max(120).optional(),
  key: Joi.string().max(120).optional(),
  level: Joi.number().min(1).optional(),
  description: Joi.string().allow(null, '').optional(),
  status: Joi.string().valid('active', 'inactive').optional()
}).min(1);