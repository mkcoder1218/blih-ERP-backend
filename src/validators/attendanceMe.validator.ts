import Joi from "joi";

export const createAttendanceEventSchema = Joi.object({
  type: Joi.string().valid("CHECK_IN", "LUNCH_OUT", "LUNCH_IN", "CHECK_OUT").required(),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  lateReasonId: Joi.string().uuid().optional().allow(null, ""),
  customReason: Joi.string().max(800).optional().allow(null, "")
});

export const historyQuerySchema = Joi.object({
  startDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: Joi.string().optional().allow("", null),
  sortBy: Joi.string().valid("date", "status", "workedMinutes").optional().default("date"),
  sortOrder: Joi.string().valid("asc", "desc").optional().default("desc"),
  page: Joi.number().integer().min(1).default(1),
  size: Joi.number().integer().min(1).max(100).default(30)
});
