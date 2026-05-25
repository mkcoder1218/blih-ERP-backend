import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { db } from "../models";
import type { AccessTokenPayload } from "../types/jwt";

function parseBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

export async function authRequired(req: Request, res: Response, next: NextFunction) {
  try {
    const token = parseBearer(req);
    if (!token) return next({ statusCode: 401, message: "Missing access token" });

    const decoded = jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload & { sub?: string };

    const user = await db.User.findByPk(decoded.sub, {
      include: [
        {
          model: db.Role,
          through: { attributes: [] },
          include: [{ model: db.Permission, through: { attributes: [] } }]
        }
      ]
    });

    if (!user) return next({ statusCode: 401, message: "Invalid user" });
    if (user.deletedAt) return next({ statusCode: 401, message: "User deleted" });
    if (user.status !== "active") return next({ statusCode: 403, message: "User is not active" });

    const roles = (user.Roles || []).map((r: any) => r.key);
    const permissions = new Set<string>();
    (user.Roles || []).forEach((r: any) => {
      (r.Permissions || []).forEach((p: any) => permissions.add(p.key));
    });

    req.user = {
      id: user.id,
      businessId: user.businessId,
      email: user.email,
      fullName: user.fullName,
      isPlatformSuperAdmin: Boolean(user.isPlatformSuperAdmin) || roles.includes("PLATFORM_SUPER_ADMIN"),
      roles,
      permissions: Array.from(permissions)
    };

    next();
  } catch {
    next({ statusCode: 401, message: "Invalid or expired token" });
  }
}

