import Joi from "joi";

export const createBusinessAdminSchema = Joi.object({
  fullName: Joi.string().min(2).max(200).required(),
  email: Joi.string().email().max(320).required(),
  phone: Joi.string().max(50).optional().allow(null, ""),
  password: Joi.string().min(8).max(128).required()
});

