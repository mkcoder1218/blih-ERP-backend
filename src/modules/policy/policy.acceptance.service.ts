import crypto from "crypto";
import { db } from "../../models";
import { computePolicyContentHash } from "./policy.sanitizer";

export class PolicyAcceptanceService {
  async acceptPolicy(
    businessId: string,
    policyId: string,
    user: any,
    reqPayload: { acceptedContentHash?: string; ipAddress?: string; userAgent?: string }
  ) {
    return db.sequelize.transaction(async (transaction: any) => {
      const policy = await db.Policy.findOne({
        where: { id: policyId, businessId, status: "published" },
        transaction
      });

      if (!policy) {
        const err: any = new Error("Published policy not found");
        err.statusCode = 404;
        throw err;
      }

      // Fetch active published version
      const version = await db.PolicyVersion.findOne({
        where: { policyId: policy.id, version: policy.version, businessId },
        transaction
      });

      if (!version) {
        const err: any = new Error("Published policy version snapshot not found");
        err.statusCode = 404;
        throw err;
      }

      if (policy.requiresSignature) {
        const err: any = new Error("This policy requires a signature. Please call the signature endpoint.");
        err.statusCode = 400;
        throw err;
      }

      // Compute canonical content hash
      const computedHash = computePolicyContentHash({
        policyId: policy.id,
        version: version.version,
        title: version.title,
        contentHtml: version.contentHtml,
        effectiveFrom: version.effectiveFrom,
        effectiveUntil: version.effectiveUntil,
        requiresAcceptance: version.requiresAcceptance,
        requiresSignature: version.requiresSignature
      });

      if (reqPayload.acceptedContentHash && reqPayload.acceptedContentHash !== computedHash) {
        const err: any = new Error("Accepted content hash does not match published policy content version");
        err.statusCode = 400;
        throw err;
      }

      // Find employee record
      const employee = await db.EmployeeRecord.findOne({
        where: { userId: user.id, businessId, status: "active" },
        transaction
      });

      // Find existing obligation or create one
      const [acceptance] = await db.PolicyAcceptance.findOrCreate({
        where: {
          policyVersionId: version.id,
          userId: user.id
        },
        defaults: {
          businessId,
          policyId: policy.id,
          policyVersionId: version.id,
          userId: user.id,
          employeeId: employee ? employee.id : null,
          policyVersion: version.version,
          status: "pending",
          assignedAt: new Date()
        },
        transaction
      });

      if (acceptance.status === "accepted" || acceptance.status === "signed") {
        return acceptance; // Idempotent
      }

      const now = new Date();
      await acceptance.update({
        status: "accepted",
        acceptedAt: now,
        acceptanceMethod: "checkbox",
        ipAddress: reqPayload.ipAddress || null,
        userAgent: reqPayload.userAgent || null,
        acceptedContentHash: computedHash
      }, { transaction });

      await policy.increment("acceptanceCount", { by: 1, transaction });

      return acceptance;
    });
  }

  async signPolicy(
    businessId: string,
    policyId: string,
    user: any,
    payload: {
      signatureType: "typed_name" | "drawn_signature";
      typedSignatureName?: string;
      signatureAttachmentId?: string;
      signatureStrokeData?: any;
      acceptedContentHash?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ) {
    return db.sequelize.transaction(async (transaction: any) => {
      const policy = await db.Policy.findOne({
        where: { id: policyId, businessId, status: "published" },
        transaction
      });

      if (!policy) {
        const err: any = new Error("Published policy not found");
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

      const computedHash = computePolicyContentHash({
        policyId: policy.id,
        version: version.version,
        title: version.title,
        contentHtml: version.contentHtml,
        effectiveFrom: version.effectiveFrom,
        effectiveUntil: version.effectiveUntil,
        requiresAcceptance: version.requiresAcceptance,
        requiresSignature: version.requiresSignature
      });

      if (payload.acceptedContentHash && payload.acceptedContentHash !== computedHash) {
        const err: any = new Error("Accepted content hash does not match published policy content version");
        err.statusCode = 400;
        throw err;
      }

      let signatureTextToHash = "";

      if (payload.signatureType === "typed_name") {
        if (!payload.typedSignatureName || payload.typedSignatureName.trim().length < 2) {
          const err: any = new Error("Typed signature name is required and must be at least 2 characters");
          err.statusCode = 400;
          throw err;
        }
        signatureTextToHash = `typed:${payload.typedSignatureName.trim()}`;
      } else if (payload.signatureType === "drawn_signature") {
        if (payload.signatureAttachmentId) {
          const attachment = await db.EntityAttachment.findOne({
            where: { id: payload.signatureAttachmentId, businessId },
            transaction
          });
          if (!attachment) {
            const err: any = new Error("Signature attachment asset not found");
            err.statusCode = 404;
            throw err;
          }
          signatureTextToHash = `attachment:${attachment.id}:${attachment.fileKey || attachment.originalName}`;
        } else if (payload.signatureStrokeData) {
          signatureTextToHash = `strokes:${JSON.stringify(payload.signatureStrokeData)}`;
        } else {
          const err: any = new Error("Drawn signature requires attachment asset or stroke data");
          err.statusCode = 400;
          throw err;
        }
      }

      const signatureHash = crypto.createHash("sha256").update(signatureTextToHash, "utf8").digest("hex");

      const employee = await db.EmployeeRecord.findOne({
        where: { userId: user.id, businessId, status: "active" },
        transaction
      });

      const [acceptance] = await db.PolicyAcceptance.findOrCreate({
        where: {
          policyVersionId: version.id,
          userId: user.id
        },
        defaults: {
          businessId,
          policyId: policy.id,
          policyVersionId: version.id,
          userId: user.id,
          employeeId: employee ? employee.id : null,
          policyVersion: version.version,
          status: "pending",
          assignedAt: new Date()
        },
        transaction
      });

      const now = new Date();
      await acceptance.update({
        status: "signed",
        acceptedAt: now,
        signedAt: now,
        acceptanceMethod: payload.signatureType,
        signatureType: payload.signatureType,
        typedSignatureName: payload.typedSignatureName ? payload.typedSignatureName.trim() : null,
        signatureAttachmentId: payload.signatureAttachmentId || null,
        signatureStrokeData: payload.signatureStrokeData || null,
        signatureHash,
        ipAddress: payload.ipAddress || null,
        userAgent: payload.userAgent || null,
        acceptedContentHash: computedHash
      }, { transaction });

      await policy.increment("acceptanceCount", { by: 1, transaction });

      return acceptance;
    });
  }

  async getAcceptanceSummary(businessId: string, policyId: string) {
    const policy = await db.Policy.findOne({
      where: { id: policyId, businessId }
    });

    if (!policy) {
      const err: any = new Error("Policy not found");
      err.statusCode = 404;
      throw err;
    }

    const version = await db.PolicyVersion.findOne({
      where: { policyId: policy.id, version: policy.version, businessId }
    });

    const versionId = version ? version.id : null;

    const acceptances = await db.PolicyAcceptance.findAll({
      where: { policyId: policy.id, businessId }
    });

    const assigned = acceptances.length;
    let pending = 0;
    let viewed = 0;
    let accepted = 0;
    let signed = 0;
    let overdue = 0;
    let superseded = 0;

    for (const acc of acceptances) {
      if (acc.status === "pending") pending++;
      else if (acc.status === "viewed") viewed++;
      else if (acc.status === "accepted") accepted++;
      else if (acc.status === "signed") signed++;
      else if (acc.status === "overdue") overdue++;
      else if (acc.status === "superseded") superseded++;
    }

    const completed = accepted + signed;
    const completionRate = assigned > 0 ? Number(((completed / assigned) * 100).toFixed(2)) : 0;

    return {
      summary: {
        policyId: policy.id,
        policyVersionId: versionId,
        assigned,
        pending,
        viewed,
        accepted,
        signed,
        declined: 0,
        overdue,
        superseded,
        completionRate
      }
    };
  }

  async exportAcceptancesCSV(businessId: string, policyId: string): Promise<string> {
    const acceptances = await db.PolicyAcceptance.findAll({
      where: { policyId, businessId },
      include: [
        { model: db.User, attributes: ["firstName", "lastName", "email"] },
        { model: db.Policy, attributes: ["title", "version"] }
      ],
      order: [["createdAt", "DESC"]]
    });

    const headers = ["EmployeeName", "Email", "PolicyTitle", "Version", "Status", "AssignedAt", "DueAt", "AcceptedAt", "SignatureType", "IPAddress"];
    const rows = acceptances.map((a: any) => {
      const name = a.User ? `${a.User.firstName} ${a.User.lastName}` : "N/A";
      const email = a.User ? a.User.email : "N/A";
      const title = a.Policy ? a.Policy.title : "N/A";
      return [
        `"${name}"`,
        `"${email}"`,
        `"${title}"`,
        a.policyVersion,
        a.status,
        a.assignedAt ? a.assignedAt.toISOString() : "",
        a.dueAt ? a.dueAt.toISOString() : "",
        a.acceptedAt ? a.acceptedAt.toISOString() : "",
        a.signatureType || a.acceptanceMethod || "checkbox",
        `"${a.ipAddress || ""}"`
      ].join(",");
    });

    return [headers.join(","), ...rows].join("\n");
  }
}
