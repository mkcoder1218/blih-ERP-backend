import Joi from "joi";

const templateFieldSchema = Joi.object({
  name: Joi.string().max(80).required(),
  label: Joi.string().max(120).required(),
  componentType: Joi.string().valid("input", "select", "textarea", "checkbox", "date", "number").required(),
  required: Joi.boolean().optional(),
  hasValidation: Joi.boolean().optional(),
  validationMessage: Joi.string().max(200).optional().allow(null, ""),
  placeholder: Joi.string().max(200).optional().allow(null, ""),
  options: Joi.array()
    .items(Joi.object({ label: Joi.string().max(80).required(), value: Joi.string().max(80).required() }))
    .optional()
});

export const createProfileTemplateSchema = Joi.object({
  name: Joi.string().max(160).required(),
  description: Joi.string().max(500).optional().allow(null, ""),
  fields: Joi.array().items(templateFieldSchema).min(1).required()
});

export const updateProfileTemplateSchema = Joi.object({
  name: Joi.string().max(160).optional(),
  description: Joi.string().max(500).optional().allow(null, ""),
  fields: Joi.array().items(templateFieldSchema).min(1).optional()
}).min(1);

