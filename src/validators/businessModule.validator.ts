
import Joi from 'joi';
export const updateBusinessModuleSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive').optional(),
  settings: Joi.object().optional()
}).min(1);
