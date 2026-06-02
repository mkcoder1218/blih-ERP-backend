import Joi from "joi";

export const createLateReasonSchema = Joi.object({
  name: Joi.string().min(2).max(160).required(),
  description: Joi.string().max(500).optional().allow(null, ""),
  isActive: Joi.boolean().optional(),
  requiresComment: Joi.boolean().optional()
});

export const updateLateReasonSchema = Joi.object({
  name: Joi.string().min(2).max(160).optional(),
  description: Joi.string().max(500).optional().allow(null, ""),
  isActive: Joi.boolean().optional(),
  requiresComment: Joi.boolean().optional()
}).min(1);

