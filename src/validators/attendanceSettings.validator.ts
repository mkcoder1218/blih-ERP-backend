import Joi from "joi";

const timeHHmm = Joi.string()
  .pattern(/^([01]\d|2[0-3]):[0-5]\d$/)
  .message("Time must be in HH:mm format (24h).");

function isIanaTimezone(value: string): boolean {
  try {
    // Node 20+: ICU-backed list of supported timezones.
    const supported = (Intl as any).supportedValuesOf?.("timeZone") as string[] | undefined;
    if (Array.isArray(supported)) return supported.includes(value);
    // Fallback: will throw for invalid zones in most runtimes.
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const upsertAttendanceSettingsSchema = Joi.object({
  attendanceEnabled: Joi.boolean().required(),

  locationName: Joi.string().max(160).allow(null, "").optional(),
  address: Joi.string().max(500).allow(null, "").optional(),
  latitude: Joi.number().min(-90).max(90).allow(null).optional(),
  longitude: Joi.number().min(-180).max(180).allow(null).optional(),
  allowedRadiusMeters: Joi.number().integer().greater(0).optional(),

  timezone: Joi.string()
    .trim()
    .max(80)
    .custom((value, helpers) => {
      if (!isIanaTimezone(value)) return helpers.error("any.invalid");
      return value;
    }, "IANA timezone validation")
    .message("timezone must be a valid IANA timezone (e.g. Africa/Nairobi).")
    .optional(),

  expectedDailyMinutes: Joi.number().integer().greater(0).optional(),
  defaultStartTime: timeHHmm.optional(),
  defaultEndTime: timeHHmm.optional(),
  lateGracePeriodMinutes: Joi.number().integer().min(0).optional(),
  lateNoReasonPenaltyGraceMinutes: Joi.number().integer().min(0).optional(),

  lunchBreakEnabled: Joi.boolean().optional(),
  lunchMode: Joi.string().valid("FIXED", "FLEXIBLE").optional(),
  fixedLunchStartTime: timeHHmm.optional().allow(null, ""),
  fixedLunchEndTime: timeHHmm.optional().allow(null, ""),
  allowMultipleLunchBreaks: Joi.boolean().optional()
})
  .custom((value, helpers) => {
    if (value.attendanceEnabled) {
      if (value.latitude === undefined || value.latitude === null) return helpers.error("any.custom", { message: "latitude is required when attendance is enabled" });
      if (value.longitude === undefined || value.longitude === null) return helpers.error("any.custom", { message: "longitude is required when attendance is enabled" });
      if (value.allowedRadiusMeters === undefined || value.allowedRadiusMeters === null) return helpers.error("any.custom", { message: "allowedRadiusMeters is required when attendance is enabled" });
      if (!value.timezone) return helpers.error("any.custom", { message: "timezone is required when attendance is enabled" });
    }

    const lunchEnabled = value.lunchBreakEnabled !== undefined ? Boolean(value.lunchBreakEnabled) : undefined;
    const lunchMode = value.lunchMode as string | undefined;
    if (lunchEnabled === false) {
      if (value.allowMultipleLunchBreaks) return helpers.error("any.custom", { message: "allowMultipleLunchBreaks requires lunchBreakEnabled=true" });
      if (value.fixedLunchStartTime || value.fixedLunchEndTime) return helpers.error("any.custom", { message: "fixed lunch times require lunchBreakEnabled=true" });
    }
    if (lunchMode === "FIXED") {
      if (!value.fixedLunchStartTime) return helpers.error("any.custom", { message: "fixedLunchStartTime is required when lunchMode=FIXED" });
      if (!value.fixedLunchEndTime) return helpers.error("any.custom", { message: "fixedLunchEndTime is required when lunchMode=FIXED" });
      if (String(value.fixedLunchStartTime) >= String(value.fixedLunchEndTime)) {
        return helpers.error("any.custom", { message: "fixedLunchStartTime must be before fixedLunchEndTime" });
      }
    }
    return value;
  })
  .messages({
    "any.custom": "{{#message}}",
    "any.invalid": "{{#message}}"
  });
