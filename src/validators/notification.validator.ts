
import Joi from 'joi';
export const bulkNotificationSchema = Joi.object({
  recipientUserIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
  moduleKey: Joi.string().max(120).required(),
  type: Joi.string().max(120).required(),
  title: Joi.string().max(255).required(),
  message: Joi.string().required(),
  entityType: Joi.string().max(120).allow(null, '').optional(),
  entityId: Joi.string().max(120).allow(null, '').optional(),
  priority: Joi.string().valid('low', 'normal', 'high', 'urgent').optional()
});

export const preferenceUpdateSchema = Joi.object({
  channel: Joi.string().valid('in_app', 'email', 'sms').required(),
  moduleKey: Joi.string().max(120).allow(null, '').optional(),
  type: Joi.string().max(120).allow(null, '').optional(),
  isEnabled: Joi.boolean().required(),
  settings: Joi.object().optional()
});
