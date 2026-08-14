import type { NextFunction, Request, Response } from "express";

const BASIC_SELF_PROFILE_FIELDS = new Set([
  "fullName",
  "phone",
  "address",
  "city",
  "country",
  "zipCode",
  "dateOfBirth",
  "maritalStatus",
  "gender",
  "nationality",
]);

/**
 * Self-service profile editing is intentionally restricted to basic personal
 * information. HR-owned fields such as department, position, role, salary,
 * employment type/status and employee code must never be accepted here.
 *
 * This middleware runs after multer so profileImage remains available through
 * req.file while req.body is reduced to the explicit allow-list below.
 */
export function restrictSelfProfileUpdate(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const source = req.body && typeof req.body === "object" ? req.body : {};
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(source)) {
    if (BASIC_SELF_PROFILE_FIELDS.has(key)) {
      sanitized[key] = value;
    }
  }

  req.body = sanitized;
  next();
}
