import type { NextFunction, Request, Response } from "express";

export function tenantWhere(req: Request, requestedBusinessId?: string) {
  if (!req.user) throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  if (req.user.isPlatformSuperAdmin) return {};
  const businessId = requestedBusinessId || req.user.businessId;
  return { businessId };
}

export function enforceTenant(paramName = "businessId") {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next({ statusCode: 401, message: "Unauthorized" });
    if (req.user.isPlatformSuperAdmin) return next();

    const requested =
      ((req.params as any)?.[paramName] as string | undefined) ||
      ((req.body as any)?.[paramName] as string | undefined) ||
      ((req.query as any)?.[paramName] as string | undefined);

    if (requested && requested !== req.user.businessId) {
      return next({ statusCode: 403, message: "Forbidden (tenant)" });
    }
    next();
  };
}

