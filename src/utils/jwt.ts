import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { AccessTokenPayload } from "../types/jwt";

export function signAccessToken(user: { id: string; businessId: string; isPlatformSuperAdmin?: boolean }): string {
  const payload: AccessTokenPayload = {
    businessId: user.businessId,
    isPlatformSuperAdmin: Boolean(user.isPlatformSuperAdmin)
  };

  return jwt.sign(payload, env.jwtAccessSecret, {
    subject: user.id,
    expiresIn: env.jwtAccessExpiresIn as any
  });
}

export function signRefreshToken(user: { id: string; businessId: string; isPlatformSuperAdmin?: boolean }): string {
  const payload: AccessTokenPayload & { type: "refresh" } = {
    businessId: user.businessId,
    isPlatformSuperAdmin: Boolean(user.isPlatformSuperAdmin),
    type: "refresh"
  } as any;

  return jwt.sign(payload, env.jwtRefreshSecret, {
    subject: user.id,
    expiresIn: env.jwtRefreshExpiresIn as any
  });
}
