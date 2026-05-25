
import Joi from 'joi';
export const submitRequestSchema = Joi.object({
  workflowId: Joi.string().uuid().required(),
  entityType: Joi.string().max(120).required(),
  entityId: Joi.string().max(120).required(),
  submittedData: Joi.object().optional()
});

export const actRequestSchema = Joi.object({
  action: Joi.string().valid('approve', 'reject', 'return', 'cancel').required(),
  comment: Joi.string().allow(null, '').optional(),
  actionData: Joi.object().optional()
});
