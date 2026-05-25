
import Joi from 'joi';
export const widgetSchema = Joi.object({
  moduleKey: Joi.string().max(120).required(),
  title: Joi.string().max(255).required(),
  key: Joi.string().max(120).required(),
  widgetType: Joi.string().valid('count', 'chart', 'table', 'list', 'progress', 'alert').required(),
  config: Joi.object().optional(),
  position: Joi.object().optional(),
  visibility: Joi.string().valid('private', 'role', 'business').optional(),
  status: Joi.string().valid('active', 'inactive').optional()
});

export const viewSchema = Joi.object({
  moduleKey: Joi.string().max(120).required(),
  entityType: Joi.string().max(120).required(),
  name: Joi.string().max(255).required(),
  filters: Joi.object().optional(),
  columns: Joi.array().optional(),
  sort: Joi.object().optional(),
  isDefault: Joi.boolean().optional()
});
