import type { NextFunction, Request, Response } from "express";

export function requireRole(...allowedRoleKeys: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next({ statusCode: 401, message: "Unauthorized" });
    if (req.user.isPlatformSuperAdmin) return next();
    const has = (req.user.roles || []).some((r) => allowedRoleKeys.includes(r));
    if (!has) return next({ statusCode: 403, message: "Forbidden (role)" });
    next();
  };
}

