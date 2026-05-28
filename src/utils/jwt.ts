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

/** Sign a short-lived (60s) download token scoped to a specific file asset. */
export function signDownloadToken(userId: string, businessId: string, fileId: string): string {
  return jwt.sign(
    { type: "download", fileId, businessId },
    env.jwtAccessSecret,
    { subject: userId, expiresIn: "60s" }
  );
}

/** Verify a download token. Returns the payload or throws. */
export function verifyDownloadToken(token: string): { fileId: string; businessId: string; sub: string } {
  const decoded = jwt.verify(token, env.jwtAccessSecret) as any;
  if (decoded?.type !== "download") throw new Error("Invalid download token");
  return { fileId: decoded.fileId, businessId: decoded.businessId, sub: decoded.sub };
}
