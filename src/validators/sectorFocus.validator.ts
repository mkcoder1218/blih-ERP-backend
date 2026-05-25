import Joi from "joi";

export const createSectorFocusSchema = Joi.object({
  name: Joi.string().max(120).required(),
  key: Joi.string().max(50).required(),
  description: Joi.string().max(255).optional().allow(null, ""),
  status: Joi.string().valid("active", "inactive").optional()
});

export const updateSectorFocusSchema = Joi.object({
  name: Joi.string().max(120).optional(),
  key: Joi.string().max(50).optional(),
  description: Joi.string().max(255).optional().allow(null, ""),
  status: Joi.string().valid("active", "inactive").optional()
}).min(1);

