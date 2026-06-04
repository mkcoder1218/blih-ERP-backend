
import Joi from 'joi';
import { EMPLOYMENT_TYPES } from '../constants/employee.constants';
export const createProfileSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  departmentId: Joi.string().uuid().allow(null).optional(),
  positionId: Joi.string().uuid().allow(null).optional(),
  employeeCode: Joi.string().max(100).allow(null, '').optional(),
  workEmail: Joi.string().email().max(320).allow(null, '').optional(),
  workPhone: Joi.string().max(50).allow(null, '').optional(),
  employmentType: Joi.string().valid(...EMPLOYMENT_TYPES).allow(null, '').optional(),
  joinedAt: Joi.date().iso().allow(null).optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
  settings: Joi.object().optional()
});
export const updateProfileSchema = Joi.object({
  departmentId: Joi.string().uuid().allow(null).optional(),
  positionId: Joi.string().uuid().allow(null).optional(),
  employeeCode: Joi.string().max(100).allow(null, '').optional(),
  workEmail: Joi.string().email().max(320).allow(null, '').optional(),
  workPhone: Joi.string().max(50).allow(null, '').optional(),
  employmentType: Joi.string().valid(...EMPLOYMENT_TYPES).allow(null, '').optional(),
  joinedAt: Joi.date().iso().allow(null).optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
  settings: Joi.object().optional()
}).min(1);
