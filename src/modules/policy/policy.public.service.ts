import crypto from "crypto";
import { db } from "../../models";

export class PolicyPublicService {
  async createPublicShare(businessId: string, policyId: string, user: any, expiresAt?: Date | null) {
    return db.sequelize.transaction(async (transaction: any) => {
      const policy = await db.Policy.findOne({
        where: { id: policyId, businessId, status: "published" },
        transaction
      });

      if (!policy) {
        const err: any = new Error("Published policy not found for public sharing");
        err.statusCode = 404;
        throw err;
      }

      const version = await db.PolicyVersion.findOne({
        where: { policyId: policy.id, version: policy.version, businessId },
        transaction
      });

      if (!version) {
        const err: any = new Error("Published policy version snapshot not found");
        err.statusCode = 404;
        throw err;
      }

      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");

      await db.PolicyPublicShare.create({
        businessId,
        policyId: policy.id,
        policyVersionId: version.id,
        tokenHash,
        enabled: true,
        expiresAt: expiresAt || null,
        createdByUserId: user.id
      }, { transaction });

      await policy.update({ publicShareEnabled: true }, { transaction });

      return {
        rawToken,
        publicPath: `/policies/share/${rawToken}`,
        policyId: policy.id,
        version: version.version,
        expiresAt: expiresAt || null
      };
    });
  }

  async revokePublicShare(businessId: string, policyId: string, user: any) {
    return db.sequelize.transaction(async (transaction: any) => {
      const policy = await db.Policy.findOne({
        where: { id: policyId, businessId },
        transaction
      });

      if (!policy) {
        const err: any = new Error("Policy not found");
        err.statusCode = 404;
        throw err;
      }

      const now = new Date();
      await db.PolicyPublicShare.update({
        enabled: false,
        revokedAt: now
      }, {
        where: { policyId: policy.id, businessId, enabled: true },
        transaction
      });

      await policy.update({ publicShareEnabled: false }, { transaction });

      return { success: true, message: "Public share revoked successfully" };
    });
  }

  async resolvePublicShareToken(rawToken: string) {
    if (!rawToken || typeof rawToken !== "string") {
      const err: any = new Error("Invalid or missing share token");
      err.statusCode = 400;
      throw err;
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken, "utf8").digest("hex");

    const share = await db.PolicyPublicShare.findOne({
      where: { tokenHash, enabled: true }
    });

    if (!share) {
      const err: any = new Error("Public share link not found or has been revoked");
      err.statusCode = 404;
      throw err;
    }

    if (share.expiresAt && new Date(share.expiresAt).getTime() <= Date.now()) {
      const err: any = new Error("Public share link has expired");
      err.statusCode = 410;
      throw err;
    }

    const policy = await db.Policy.findOne({
      where: { id: share.policyId, businessId: share.businessId }
    });

    if (!policy || policy.status !== "published" || !policy.publicShareEnabled) {
      const err: any = new Error("Policy is no longer published or publicly shared");
      err.statusCode = 404;
      throw err;
    }

    const version = await db.PolicyVersion.findOne({
      where: { id: share.policyVersionId, policyId: policy.id, businessId: share.businessId }
    });

    if (!version) {
      const err: any = new Error("Published policy version snapshot not found");
      err.statusCode = 404;
      throw err;
    }

    const [business, branding] = await Promise.all([
      db.Business.findByPk(share.businessId, {
        attributes: ["name"]
      }),
      db.BusinessBranding.findOne({
        where: { businessId: share.businessId },
        attributes: ["companyName", "tagline", "primaryColor", "accentColor"]
      })
    ]);

    // Return minimal, sanitized public payload (omitting businessId, ownerUserId, metadata, etc.)
    return {
      title: version.title,
      summary: version.summary,
      contentHtml: version.contentHtml,
      policyType: version.policyType,
      versionLabel: version.versionLabel,
      effectiveFrom: version.effectiveFrom,
      effectiveUntil: version.effectiveUntil,
      publishedAt: policy.publishedAt,
      company: {
        name: branding?.companyName || business?.name || "Company",
        tagline: branding?.tagline || null,
        primaryColor: branding?.primaryColor || null,
        accentColor: branding?.accentColor || null
      }
    };
  }
}
