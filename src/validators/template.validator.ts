
import Joi from 'joi';
export const applyTemplateSchema = Joi.object({
  targetBusinessId: Joi.string().uuid().optional(),
  moduleKey: Joi.string().max(120).required()
});
