
import Joi from 'joi';
export const createFormDefSchema = Joi.object({
  name: Joi.string().max(200).required(),
  key: Joi.string().max(120).required(),
  moduleKey: Joi.string().max(120).required(),
  description: Joi.string().allow(null, '').optional(),
  status: Joi.string().valid('active', 'inactive', 'archived').optional(),
  requiresApproval: Joi.boolean().optional(),
  approvalWorkflowId: Joi.string().uuid().allow(null).optional(),
  settings: Joi.object().optional()
});

export const createFormFieldSchema = Joi.object({
  formDefinitionId: Joi.string().uuid().required(),
  label: Joi.string().max(200).required(),
  key: Joi.string().max(120).required(),
  type: Joi.string().max(50).required(),
  required: Joi.boolean().optional(),
  options: Joi.array().allow(null).optional(),
  validationRules: Joi.object().optional(),
  orderIndex: Joi.number().optional(),
  visibilityRules: Joi.object().optional(),
  settings: Joi.object().optional()
});
