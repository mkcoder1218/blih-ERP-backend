import type { NextFunction, Request, Response } from "express";

export function requirePermission(...permissionKeys: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next({ statusCode: 401, message: "Unauthorized" });
    if (req.user.isPlatformSuperAdmin) return next();
    const userPerms = new Set(req.user.permissions || []);
    const ok = permissionKeys.every((k) => userPerms.has(k));
    if (!ok) return next({ statusCode: 403, message: "Forbidden (permission)" });
    next();
  };
}

