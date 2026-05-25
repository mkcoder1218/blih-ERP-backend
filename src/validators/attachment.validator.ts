
import Joi from 'joi';
export const attachEntitySchema = Joi.object({
  fileAssetId: Joi.string().uuid().required(),
  entityType: Joi.string().max(120).required(),
  entityId: Joi.string().max(120).required(),
  moduleKey: Joi.string().max(120).required(),
  attachmentType: Joi.string().max(100).allow(null, '').optional()
});
