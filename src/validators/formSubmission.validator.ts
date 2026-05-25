
import Joi from 'joi';
export const submitDataSchema = Joi.object({
  formDefinitionId: Joi.string().uuid().required(),
  entityType: Joi.string().max(120).allow(null, '').optional(),
  entityId: Joi.string().max(120).allow(null, '').optional(),
  data: Joi.object().required(),
  status: Joi.string().valid('draft', 'submitted').required()
});
