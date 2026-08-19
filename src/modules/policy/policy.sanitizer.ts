import crypto from "crypto";
import { sanitizeArticleContent } from "../brain/brain.sanitizer";

export { sanitizeArticleContent };

export interface CanonicalPolicyHashData {
  policyId: string;
  version: number;
  title: string;
  contentHtml: string;
  effectiveFrom?: string | Date | null;
  effectiveUntil?: string | Date | null;
  requiresAcceptance: boolean;
  requiresSignature: boolean;
}

export function computePolicyContentHash(data: CanonicalPolicyHashData): string {
  const sanitizedHtml = sanitizeArticleContent(data.contentHtml || "").content.replace(/\r\n/g, "\n");
  const normalizedTitle = (data.title || "").trim().replace(/\r\n/g, "\n");

  const normalizeDate = (d: any): string => {
    if (!d) return "";
    const dateObj = d instanceof Date ? d : new Date(d);
    return isNaN(dateObj.getTime()) ? "" : dateObj.toISOString();
  };

  const canonicalString = [
    `policyId:${data.policyId || ""}`,
    `version:${data.version || 1}`,
    `title:${normalizedTitle}`,
    `contentHtml:${sanitizedHtml}`,
    `effectiveFrom:${normalizeDate(data.effectiveFrom)}`,
    `effectiveUntil:${normalizeDate(data.effectiveUntil)}`,
    `requiresAcceptance:${Boolean(data.requiresAcceptance)}`,
    `requiresSignature:${Boolean(data.requiresSignature)}`
  ].join("\n");

  return crypto.createHash("sha256").update(canonicalString, "utf8").digest("hex");
}
