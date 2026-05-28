import Joi from "joi";

export const createProfileDraftSchema = Joi.object({
  templateId: Joi.string().uuid().required(),
  status: Joi.string().valid("draft", "completed").optional(),
  data: Joi.object().required()
});

export const updateProfileDraftSchema = Joi.object({
  status: Joi.string().valid("draft", "completed").optional(),
  data: Joi.object().optional()
}).min(1);

