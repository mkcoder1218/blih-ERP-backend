import type { Request, Response } from "express";
import { PolicyService } from "./policy.service";
import { PolicyAcceptanceService } from "./policy.acceptance.service";
import { PolicyPublicService } from "./policy.public.service";
import { db } from "../../models";
import { errorResponse, successResponse } from "../../utils/response";

export class PolicyController {
  private policyService = new PolicyService();
  private acceptanceService = new PolicyAcceptanceService();
  private publicService = new PolicyPublicService();

  // ── Categories ──────────────────────────────────────────────────────────

  createCategory = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const category = await this.policyService.createCategory(businessId, req.body, req.user);
    successResponse(res, { category }, "Category created successfully", 201);
  };

  listCategories = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const result = await this.policyService.listCategories(businessId, req.query);
    successResponse(res, result, "Categories fetched successfully");
  };

  getCategory = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const category = await this.policyService.getCategory(businessId, req.params.id);
    successResponse(res, { category }, "Category fetched successfully");
  };

  updateCategory = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const category = await this.policyService.updateCategory(businessId, req.params.id, req.body, req.user);
    successResponse(res, { category }, "Category updated successfully");
  };

  deleteCategory = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const result = await this.policyService.deleteCategory(businessId, req.params.id, req.user);
    successResponse(res, result, "Category deleted successfully");
  };

  restoreCategory = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const category = await this.policyService.restoreCategory(businessId, req.params.id, req.user);
    successResponse(res, { category }, "Category restored successfully");
  };

  // ── Policy CRUD ─────────────────────────────────────────────────────────

  createPolicy = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const policy = await this.policyService.createPolicy(businessId, req.body, req.user);
    successResponse(res, { policy }, "Policy created successfully", 201);
  };

  listPolicies = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const result = await this.policyService.listPolicies(businessId, req.user, req.query);
    successResponse(res, result, "Policies fetched successfully");
  };

  getPolicy = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const policy = await this.policyService.getPolicy(businessId, req.params.id, req.user);
    successResponse(res, { policy }, "Policy fetched successfully");
  };

  updatePolicy = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const policy = await this.policyService.updatePolicy(businessId, req.params.id, req.body, req.user);
    successResponse(res, { policy }, "Policy updated successfully");
  };

  deletePolicy = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const result = await this.policyService.deletePolicy(businessId, req.params.id, req.user);
    successResponse(res, result, "Policy deleted successfully");
  };

  restorePolicy = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const policy = await this.policyService.restorePolicy(businessId, req.params.id, req.user);
    successResponse(res, { policy }, "Policy restored successfully");
  };

  // ── Workflow Transitions ──────────────────────────────────────────────────

  submitForReview = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const policy = await this.policyService.submitForReview(businessId, req.params.id, req.user);
    successResponse(res, { policy }, "Policy submitted for review");
  };

  requestChanges = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const policy = await this.policyService.requestChanges(businessId, req.params.id, req.user, req.body.comment);
    successResponse(res, { policy }, "Changes requested on policy");
  };

  approvePolicy = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const policy = await this.policyService.approvePolicy(businessId, req.params.id, req.user);
    successResponse(res, { policy }, "Policy approved successfully");
  };

  schedulePolicy = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const policy = await this.policyService.schedulePolicy(businessId, req.params.id, req.user, req.body.effectiveFrom);
    successResponse(res, { policy }, "Policy scheduled successfully");
  };

  publishPolicy = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const policy = await this.policyService.publishPolicy(businessId, req.params.id, req.user);
    successResponse(res, { policy }, "Policy published successfully");
  };

  unpublishPolicy = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const policy = await this.policyService.unpublishPolicy(businessId, req.params.id, req.user);
    successResponse(res, { policy }, "Policy unpublished successfully");
  };

  supersedePolicy = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const policy = await this.policyService.supersedePolicy(businessId, req.params.id, req.user, req.body.supersededByPolicyId);
    successResponse(res, { policy }, "Policy superseded successfully");
  };

  archivePolicy = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const policy = await this.policyService.archivePolicy(businessId, req.params.id, req.user);
    successResponse(res, { policy }, "Policy archived successfully");
  };

  // ── Versions ─────────────────────────────────────────────────────────────

  listVersions = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const versions = await this.policyService.listVersions(businessId, req.params.id);
    successResponse(res, { versions }, "Policy versions fetched successfully");
  };

  getVersion = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const version = await this.policyService.getVersion(businessId, req.params.id, req.params.versionId);
    successResponse(res, { version }, "Policy version fetched successfully");
  };

  restoreVersion = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const policy = await this.policyService.restoreVersion(businessId, req.params.id, req.params.versionId, req.user);
    successResponse(res, { policy }, "Policy version restored into new draft version");
  };

  // ── Assignments ──────────────────────────────────────────────────────────

  listAssignments = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const assignments = await db.PolicyAssignment.findAll({
      where: { policyId: req.params.id, businessId }
    });
    successResponse(res, { assignments }, "Policy assignments fetched");
  };

  updateAssignments = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const policyId = req.params.id;

    await db.sequelize.transaction(async (transaction: any) => {
      const policy = await db.Policy.findOne({
        where: { id: policyId, businessId },
        transaction
      });
      if (!policy) {
        const err: any = new Error("Policy not found");
        err.statusCode = 404;
        throw err;
      }

      const version = await db.PolicyVersion.findOne({
        where: { policyId: policy.id, version: policy.version, businessId },
        transaction
      });

      const versionId = version ? version.id : policy.id;

      // Soft-delete old assignments
      await db.PolicyAssignment.destroy({
        where: { policyId, businessId },
        transaction
      });

      // Create new assignments with company subjectId normalized to 'ALL'
      for (const item of req.body.assignments) {
        const subjectId = item.subjectType === "COMPANY" ? "ALL" : item.subjectId;
        await db.PolicyAssignment.create({
          businessId,
          policyId,
          policyVersionId: versionId,
          subjectType: item.subjectType,
          subjectId,
          assignmentType: item.assignmentType || "INCLUDE",
          isRequired: item.isRequired !== undefined ? item.isRequired : true,
          requiresAcceptance: item.requiresAcceptance !== undefined ? item.requiresAcceptance : true,
          requiresSignature: item.requiresSignature !== undefined ? item.requiresSignature : false,
          dueAt: item.dueAt || null,
          assignedByUserId: req.user!.id
        }, { transaction });
      }
    });

    const assignments = await db.PolicyAssignment.findAll({
      where: { policyId, businessId }
    });

    successResponse(res, { assignments }, "Policy assignments updated successfully");
  };

  // ── Acceptance & Signatures ────────────────────────────────────────────────

  acceptPolicy = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const acceptance = await this.acceptanceService.acceptPolicy(
      businessId,
      req.params.id,
      req.user,
      {
        acceptedContentHash: req.body.acceptedContentHash,
        ipAddress: req.ip,
        userAgent: req.header("user-agent") || undefined
      }
    );
    successResponse(res, { acceptance }, "Policy accepted successfully");
  };

  signPolicy = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const acceptance = await this.acceptanceService.signPolicy(
      businessId,
      req.params.id,
      req.user,
      {
        signatureType: req.body.signatureType,
        typedSignatureName: req.body.typedSignatureName,
        signatureAttachmentId: req.body.signatureAttachmentId,
        signatureStrokeData: req.body.signatureStrokeData,
        acceptedContentHash: req.body.acceptedContentHash,
        ipAddress: req.ip,
        userAgent: req.header("user-agent") || undefined
      }
    );
    successResponse(res, { acceptance }, "Policy signed successfully");
  };

  getMyRequiredPolicies = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const acceptances = await db.PolicyAcceptance.findAll({
      where: { userId: req.user!.id, businessId, status: ["pending", "viewed", "overdue"] },
      include: [{ model: db.Policy, attributes: ["id", "title", "slug", "policyType", "version", "requiresSignature"] }]
    });
    successResponse(res, { rows: acceptances }, "Required policies fetched");
  };

  getMyAcceptances = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const acceptances = await db.PolicyAcceptance.findAll({
      where: { userId: req.user!.id, businessId, status: ["accepted", "signed"] },
      include: [{ model: db.Policy, attributes: ["id", "title", "slug", "policyType", "version"] }]
    });
    successResponse(res, { rows: acceptances }, "My policy acceptances fetched");
  };

  getAcceptanceSummary = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const result = await this.acceptanceService.getAcceptanceSummary(businessId, req.params.id);
    successResponse(res, result, "Acceptance summary fetched");
  };

  listAcceptances = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const page = parseInt((req.query.page as string) || "1", 10);
    const size = Math.min(parseInt((req.query.size as string) || "20", 10), 100);
    const offset = (page - 1) * size;

    const where: any = { businessId };
    if (req.query.status) where.status = req.query.status;

    const { count, rows } = await db.PolicyAcceptance.findAndCountAll({
      where,
      limit: size,
      offset,
      order: [["createdAt", "DESC"]],
      include: [
        { model: db.User, attributes: ["id", "firstName", "lastName", "email"] },
        { model: db.Policy, attributes: ["id", "title", "version"] }
      ]
    });

    successResponse(res, { rows, count, page, size, pages: Math.ceil(count / size) }, "Acceptances fetched");
  };

  exportAcceptancesCSV = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const csvContent = await this.acceptanceService.exportAcceptancesCSV(businessId, req.params.id);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="policy-${req.params.id}-acceptances.csv"`);
    res.status(200).send(csvContent);
  };

  // ── Public Sharing ────────────────────────────────────────────────────────

  createPublicShare = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const result = await this.publicService.createPublicShare(
      businessId,
      req.params.id,
      req.user,
      req.body.expiresAt ? new Date(req.body.expiresAt) : null
    );
    successResponse(res, result, "Public share link generated successfully", 201);
  };

  revokePublicShare = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const result = await this.publicService.revokePublicShare(businessId, req.params.id, req.user);
    successResponse(res, result, "Public share revoked");
  };

  resolvePublicShareToken = async (req: Request, res: Response) => {
    const publicPayload = await this.publicService.resolvePublicShareToken(req.params.token);
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    successResponse(res, publicPayload, "Public policy fetched successfully");
  };

  // ── Deprecated Guest Policy Route (Restricted to platform-global policies only) ──

  getGuestPolicy = async (req: Request, res: Response) => {
    // Mandatory correction #9: Restrict guest route strictly to platform-global policies where businessId IS NULL
    const policy = await db.Policy.findOne({
      where: {
        policyType: req.params.policyType,
        status: "published",
        businessId: null
      },
      order: [["version", "DESC"], ["publishedAt", "DESC"]],
      attributes: ["id", "policyType", "title", "slug", "version", "publishedAt", "contentHtml", "contentText"]
    });

    if (!policy) {
      return errorResponse(res, "Platform-global policy not found or not published", 404);
    }

    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    successResponse(res, policy, "Platform-global policy fetched");
  };
}
