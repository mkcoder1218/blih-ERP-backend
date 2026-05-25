
import Joi from 'joi';
export const createWorkflowSchema = Joi.object({
  name: Joi.string().max(200).required(),
  key: Joi.string().max(120).required(),
  moduleKey: Joi.string().max(120).required(),
  entityType: Joi.string().max(120).required(),
  description: Joi.string().allow(null, '').optional(),
  status: Joi.string().valid('active', 'inactive').optional(),
  settings: Joi.object().optional()
});

export const createStepSchema = Joi.object({
  workflowId: Joi.string().uuid().required(),
  stepOrder: Joi.number().required(),
  approverType: Joi.string().valid('user', 'role', 'department').required(),
  approverRoleId: Joi.string().uuid().allow(null).optional(),
  approverUserId: Joi.string().uuid().allow(null).optional(),
  approverDepartmentId: Joi.string().uuid().allow(null).optional(),
  actionRequired: Joi.string().valid('any', 'all').optional(),
  isFinalStep: Joi.boolean().optional(),
  settings: Joi.object().optional()
});
