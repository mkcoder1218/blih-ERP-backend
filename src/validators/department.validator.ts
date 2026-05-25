
import Joi from 'joi';
export const createDepartmentSchema = Joi.object({
  name: Joi.string().max(120).required(),
  key: Joi.string().max(120).required(),
  description: Joi.string().allow(null, '').optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
  parentDepartmentId: Joi.string().uuid().allow(null).optional()
});
export const updateDepartmentSchema = Joi.object({
  name: Joi.string().max(120).optional(),
  key: Joi.string().max(120).optional(),
  description: Joi.string().allow(null, '').optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
  parentDepartmentId: Joi.string().uuid().allow(null).optional()
}).min(1);