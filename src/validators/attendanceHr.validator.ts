import Joi from "joi";

export const summaryQuerySchema = Joi.object({
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  departmentId: Joi.string().uuid().optional().allow("", null)
});

export const dailyQuerySchema = Joi.object({
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  departmentId: Joi.string().uuid().optional().allow("", null),
  status: Joi.string()
    .valid("NOT_STARTED", "IN_PROGRESS", "ON_BREAK", "COMPLETED", "MISSED", "LATE", "OUTSIDE_RADIUS_ATTEMPT")
    .optional()
    .allow("", null),
  search: Joi.string().max(120).optional().allow("", null),
  sortBy: Joi.string().valid("name", "checkInTime", "workedMinutes", "status").optional().default("name"),
  sortOrder: Joi.string().valid("asc", "desc").optional().default("asc")
});

export const employeeDailyParamsSchema = Joi.object({
  employeeId: Joi.string().uuid().required()
});

export const employeeDailyQuerySchema = Joi.object({
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export const reportQuerySchema = Joi.object({
  startDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  endDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  departmentId: Joi.string().uuid().optional().allow("", null),
  employeeId: Joi.string().uuid().optional().allow("", null),
  status: Joi.string().optional().allow("", null),
  search: Joi.string().max(120).optional().allow("", null),
  sortBy: Joi.string().valid("date", "name", "workedMinutes", "status").optional().default("date"),
  sortOrder: Joi.string().valid("asc", "desc").optional().default("asc")
}).custom((value, helpers) => {
  if (value.startDate && value.endDate && value.startDate > value.endDate) {
    return helpers.error("any.custom", { message: "startDate must be <= endDate" });
  }
  return value;
}).messages({ "any.custom": "{{#message}}" });

export const exportQuerySchema = reportQuerySchema.keys({
  format: Joi.string().valid("csv").optional().default("csv")
});
