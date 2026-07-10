import crypto from "crypto";
import { env } from "../config/env";

const algorithm = "aes-256-gcm";

function key() {
  const source = process.env.CREDENTIAL_ENCRYPTION_KEY || env.jwtRefreshSecret || env.jwtAccessSecret;
  return crypto.createHash("sha256").update(source).digest();
}

export function encryptCredential(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptCredential(value: string): string {
  const [ivRaw, tagRaw, encryptedRaw] = value.split(":");
  if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error("Invalid encrypted credential format");
  const decipher = crypto.createDecipheriv(algorithm, key(), Buffer.from(ivRaw, "base64"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function maskSecret(value?: string | null): string | null {
  if (!value) return null;
  if (value.includes("@")) {
    const [name, domain] = value.split("@");
    return `${name.slice(0, 2)}***@${domain}`;
  }
  return value.length <= 4 ? "****" : `${value.slice(0, 2)}***${value.slice(-2)}`;
}
