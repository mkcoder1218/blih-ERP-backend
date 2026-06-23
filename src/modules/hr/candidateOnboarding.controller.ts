import { Request, Response } from "express";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import path from "path";
import fs from "fs";
import { db } from "../../models";
import { errorResponse, successResponse } from "../../utils/response";
import { sendOnboardingInviteEmail } from "../../utils/onboardingMailer";
import { DEFAULT_EMPLOYMENT_TYPE, EMPLOYMENT_TYPES, type EmploymentType } from "../../constants/employee.constants";
import { env } from "../../config/env";

export class CandidateOnboardingController {
  private readonly policyTypes = [
    "terms-and-conditions",
    "privacy-policy",
    "code-of-conduct",
    "nda",
    "it-security",
    "acceptable-use",
    "data-protection",
    "other",
  ];

  private normalizeEmploymentType(input: unknown): EmploymentType {
    const value = (input ?? "").toString().trim();
    return EMPLOYMENT_TYPES.includes(value as EmploymentType) ? value as EmploymentType : DEFAULT_EMPLOYMENT_TYPE;
  }

  private async fetchGuestPolicy(policyType: string) {
    if (env.policiesApiBaseUrl && env.guestApiKey) {
      const base = env.policiesApiBaseUrl.replace(/\/$/, "");
      const response = await fetch(`${base}/policies/guest/${encodeURIComponent(policyType)}`, {
        headers: { "x-api-key": env.guestApiKey },
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Policy service ${response.status}: ${text || `Could not fetch ${policyType} policy`}`);
      }
      const payload: any = await response.json();
      const data = payload?.data?.policy || payload?.data?.policies?.[0] || payload?.data || payload?.policy || payload;
      return Array.isArray(data) ? data[0] : data;
    }

    const policy = await db.Policy.findOne({
      where: { policyType, status: "active" },
      order: [["version", "DESC"], ["publishedAt", "DESC"]],
    });
    if (!policy) return null;
    const json = policy.toJSON ? policy.toJSON() : policy;
    return {
      _id: json.id,
      policyType: json.policyType,
      title: json.title,
      version: json.version,
      isRequired: json.isRequired,
      publishedAt: json.publishedAt,
      contentHtml: json.contentHtml,
      contentText: json.contentText,
    };
  }

  private fallbackPolicySnapshot(policyType: string) {
    const title = policyType
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
    return {
      policyId: policyType,
      policyType,
      title: title || "Company Policy",
      version: 1,
      required: true,
      content: "Please review and accept this company policy before completing onboarding.",
      contentHtml: null,
      publishedAt: null,
    };
  }

  private policySnapshotFromGuestPolicy(policy: any, policyType: string) {
    return {
      policyId: policy._id || policy.id || policy.policyType || policyType,
      policyType: policy.policyType || policyType,
      title: policy.title || this.fallbackPolicySnapshot(policyType).title,
      version: policy.version || 1,
      required: policy.isRequired !== false,
      content: policy.contentText || policy.content || policy.bodyText || policy.description || "",
      contentHtml: policy.contentHtml || policy.html || policy.bodyHtml || null,
      publishedAt: policy.publishedAt || null,
    };
  }

  private async buildPolicySnapshots(policyTypes: string[]) {
    const snapshots = await Promise.all(
      policyTypes.map(async (policyType) => {
        const policy = await this.fetchGuestPolicy(policyType);
        return this.policySnapshotFromGuestPolicy(policy, policyType);
      })
    );
    return snapshots;
  }

  private normalizeDeadline(value: unknown) {
    if (!value) return null;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private isExpired(onboarding: any) {
    const expiresAt = onboarding.metadata?.expiresAt;
    return expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;
  }

  private buildOnboardingUrl(businessSlug: string, onboardingId: string) {
    const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
    return `${frontendUrl}/register/${encodeURIComponent(businessSlug)}?onboarding=${encodeURIComponent(onboardingId)}`;
  }

  // POST /api/v1/hr/onboarding/initialize
  // Auth required — HR_MANAGER or BUSINESS_ADMIN
  initialize = async (req: Request, res: Response) => {
    try {
      const businessId = req.user!.businessId;
      const {
        offerId,
        sections,
        resources,
        requiredDocuments,
        requiredPolicies,
        inventoryItemIds,
        assignedEmail,
        expiresAt,
        deadlineDays,
        policyTypes,
      } = req.body;

      if (!offerId) {
        return errorResponse(res, "offerId is required", 400);
      }

      // Find the offer letter
      const offer = await db.OfferLetter.findOne({ where: { id: offerId, businessId } });
      if (!offer) {
        return errorResponse(res, "Offer letter not found", 404);
      }
      if (offer.status !== "ACCEPTED") {
        return errorResponse(res, "Onboarding can only be initialized for ACCEPTED offers", 400);
      }

      // Check if already initialized — resend the email with the existing link
      const existing = await db.CandidateOnboarding.findOne({ where: { offerId, businessId } });
      if (existing) {
        const nextExpiresAt = this.normalizeDeadline(expiresAt) || (deadlineDays ? new Date(Date.now() + Number(deadlineDays) * 86400000) : null);
        const requestedPolicyTypes = Array.isArray(policyTypes) && policyTypes.length
          ? policyTypes
          : (existing.requiredPolicies || []).map((policy: any) => policy.policyType).filter(Boolean);
        const finalPolicySnapshots = requestedPolicyTypes.length
          ? await this.buildPolicySnapshots(requestedPolicyTypes)
          : [];
        await existing.update({
          sections: sections && sections.length > 0 ? sections : existing.sections,
          resources: resources || existing.resources,
          requiredDocuments: [],
          requiredPolicies: finalPolicySnapshots.length ? finalPolicySnapshots : (requiredPolicies || existing.requiredPolicies),
          metadata: {
            ...(existing.metadata || {}),
            ...(assignedEmail ? { assignedEmail } : {}),
            ...(nextExpiresAt ? { expiresAt: nextExpiresAt.toISOString() } : {}),
            policyTypes: requestedPolicyTypes,
          },
          candidateData: assignedEmail
            ? { ...(existing.candidateData || {}), personal_info: { ...((existing.candidateData || {}).personal_info || {}), email: assignedEmail } }
            : existing.candidateData,
        });
        const business = await db.Business.findByPk(businessId, { attributes: ["name", "slug"] }).catch(() => null);
        const onboardingUrl = this.buildOnboardingUrl(business?.slug || "", existing.onboardingId);

        // Resend the invite email
        sendOnboardingInviteEmail({
          candidateName:  existing.candidateName,
          candidateEmail: existing.candidateEmail,
          companyName:    business?.name || "Blih",
          onboardingUrl,
          startDate:      existing.metadata?.startDate || undefined,
          positionTitle:  existing.metadata?.positionTitle || existing.metadata?.position || undefined,
        }).catch((err: any) =>
          console.error("[OnboardingMailer] Failed to resend invite:", err)
        );

        return successResponse(res, { onboarding: existing, onboardingUrl }, "Onboarding already initialized — invite email resent");
      }

      const onboardingId = randomUUID();

      const defaultSections = [
        "overview",
        "personal_info",
        "documents",
        "emergency_contact",
        "payroll",
        "policies",
        "resources",
        "review",
      ];

      const selectedInventory = inventoryItemIds?.length
        ? await db.InventoryItem.findAll({ where: { id: inventoryItemIds, businessId, status: "AVAILABLE" } })
        : [];
      if (inventoryItemIds?.length && selectedInventory.length !== inventoryItemIds.length) {
        return errorResponse(res, "One or more inventory items are unavailable", 400);
      }

      const inventoryResources = selectedInventory.map((item: any) => ({
        inventoryItemId: item.id,
        resourceName: item.name,
        resourceType: item.category,
        quantity: 1,
        condition: item.condition,
        assetTag: item.assetTag,
        serialNumber: item.serialNumber,
        returnRequired: true,
        acceptanceRequired: true,
      }));

      const requestedPolicyTypes = Array.isArray(policyTypes) && policyTypes.length ? policyTypes : ["terms-and-conditions"];
      const finalPolicySnapshots = await this.buildPolicySnapshots(requestedPolicyTypes);
      const finalSections = sections && sections.length > 0 ? sections : defaultSections;
      const finalResources = [...(resources || []), ...inventoryResources];
      const nextExpiresAt = this.normalizeDeadline(expiresAt) || (deadlineDays ? new Date(Date.now() + Number(deadlineDays) * 86400000) : null);

      const onboarding = await db.CandidateOnboarding.create({
        onboardingId,
        businessId,
        offerId,
        candidateEmail: offer.candidateEmail,
        candidateName: offer.candidateName,
        status: "PENDING_CANDIDATE_COMPLETION",
        sections: finalResources.length && !finalSections.includes("resources") ? [...finalSections, "resources"] : finalSections,
        resources: finalResources,
        requiredDocuments: [],
        requiredPolicies: finalPolicySnapshots.length ? finalPolicySnapshots : (requiredPolicies || []),
        candidateData: assignedEmail ? { personal_info: { email: assignedEmail } } : {},
        resourceResponses: [],
        progress: 0,
        initializedById: req.user!.id,
        metadata: {
          salary: offer.salary,
          startDate: offer.startDate,
          employmentType: offer.employmentType,
          workLocation: offer.workLocation,
          reportingManager: offer.reportingManager,
          assignedEmail: assignedEmail || null,
          expiresAt: nextExpiresAt ? nextExpiresAt.toISOString() : null,
          policyTypes: requestedPolicyTypes,
        },
      });

      if (selectedInventory.length) {
        await Promise.all(selectedInventory.map((item: any) => item.update({
          status: "RESERVED",
          reservedForOnboardingId: onboarding.id,
        })));
      }

      // Mark offer as onboarding initialized
      await db.OfferLetter.update(
        { onboardingInitialized: true },
        { where: { id: offerId } }
      );

      const business = await db.Business.findByPk(businessId, { attributes: ["name", "slug"] }).catch(() => null);
      const onboardingUrl = this.buildOnboardingUrl(business?.slug || "", onboardingId);

      // Send onboarding invite email to candidate (fire-and-forget)
      const companyName = business?.name || "Blih";

      sendOnboardingInviteEmail({
        candidateName:  offer.candidateName,
        candidateEmail: offer.candidateEmail,
        companyName,
        onboardingUrl,
        startDate:      offer.startDate   || undefined,
        positionTitle:  offer.metadata?.positionTitle || offer.metadata?.position || undefined,
      }).catch((err: any) =>
        console.error("[OnboardingMailer] Failed to send invite:", err)
      );

      successResponse(res, { onboarding, onboardingUrl }, "Onboarding initialized", 201);
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  listAvailablePolicies = async (_req: Request, res: Response) => {
    try {
      const results = await Promise.all(
        this.policyTypes.map(async (policyType) => {
          try {
            const policy = await this.fetchGuestPolicy(policyType);
            if (!policy) return null;
            return {
              policyId: policy._id || policy.id || policy.policyType || policyType,
              policyType: policy.policyType || policyType,
              title: policy.title || this.fallbackPolicySnapshot(policyType).title,
              version: policy.version || 1,
              required: policy.isRequired !== false,
              publishedAt: policy.publishedAt || null,
            };
          } catch {
            return null;
          }
        })
      );

      successResponse(res, results.filter(Boolean));
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  // GET /api/v1/hr/onboarding — list all for business
  list = async (req: Request, res: Response) => {
    try {
      const businessId = req.user!.businessId;
      const limit = Number(req.query.limit || 50);
      const offset = Number(req.query.offset || 0);

      const result = await db.CandidateOnboarding.findAndCountAll({
        where: { businessId },
        limit,
        offset,
        order: [["createdAt", "DESC"]],
      });

      successResponse(res, { rows: result.rows, count: result.count });
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  // GET /api/v1/hr/onboarding/by-offer/:offerId — get by offerId (admin view)
  getByOfferId = async (req: Request, res: Response) => {
    try {
      const businessId = req.user!.businessId;
      const { offerId } = req.params;

      const onboarding = await db.CandidateOnboarding.findOne({
        where: { offerId, businessId },
      });

      if (!onboarding) {
        return successResponse(res, null, "No onboarding found for this offer");
      }

      successResponse(res, onboarding);
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  // GET /api/v1/hr/onboarding/:id — get by DB id (admin view)
  getById = async (req: Request, res: Response) => {
    try {
      const businessId = req.user!.businessId;
      const { id } = req.params;

      const onboarding = await db.CandidateOnboarding.findOne({
        where: { id, businessId },
      });

      if (!onboarding) {
        return errorResponse(res, "Onboarding not found", 404);
      }

      successResponse(res, onboarding);
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  // GET /api/v1/hr/public/onboarding/:onboardingId — PUBLIC, no auth
  getPublic = async (req: Request, res: Response) => {
    try {
      const { onboardingId } = req.params;

      const onboarding = await db.CandidateOnboarding.findOne({
        where: { onboardingId },
      });

      if (!onboarding) {
        return errorResponse(res, "Onboarding session not found", 404);
      }

      if (onboarding.status === "CANCELLED") {
        return errorResponse(res, "This onboarding session has been cancelled", 410);
      }
      if (this.isExpired(onboarding)) {
        return errorResponse(res, "This onboarding session has expired. Please contact HR for a new link.", 410);
      }

      const payload = onboarding.toJSON ? onboarding.toJSON() : onboarding;
      const requiredPolicies = Array.isArray(payload.requiredPolicies) ? payload.requiredPolicies : [];
      const metadataPolicyTypes = Array.isArray(payload.metadata?.policyTypes) ? payload.metadata.policyTypes : [];
      const fallbackPolicyTypes = metadataPolicyTypes.length
        ? metadataPolicyTypes
        : (Array.isArray(payload.sections) && payload.sections.includes("policies") ? ["terms-and-conditions"] : []);
      if (!requiredPolicies.length && fallbackPolicyTypes.length) {
        payload.requiredPolicies = fallbackPolicyTypes.map((type: string) => this.fallbackPolicySnapshot(type));
      }

      successResponse(res, payload);
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  getPublicPolicy = async (req: Request, res: Response) => {
    try {
      const { onboardingId, policyType } = req.params;
      const onboarding = await db.CandidateOnboarding.findOne({ where: { onboardingId } });

      if (!onboarding) {
        return errorResponse(res, "Onboarding session not found", 404);
      }
      if (onboarding.status === "CANCELLED") {
        return errorResponse(res, "This onboarding session has been cancelled", 410);
      }
      if (this.isExpired(onboarding)) {
        return errorResponse(res, "This onboarding session has expired. Please contact HR for a new link.", 410);
      }

      const requiredPolicies = Array.isArray(onboarding.requiredPolicies) ? onboarding.requiredPolicies : [];
      const isAllowed = requiredPolicies.some((policy: any) => policy.policyType === policyType || policy.policyId === policyType);
      const metadataPolicyTypes = Array.isArray(onboarding.metadata?.policyTypes) ? onboarding.metadata.policyTypes : [];
      const allowsLegacyPolicy = Array.isArray(onboarding.sections) && onboarding.sections.includes("policies") && policyType === "terms-and-conditions";
      if (!isAllowed && !metadataPolicyTypes.includes(policyType) && !allowsLegacyPolicy) {
        return errorResponse(res, "Policy is not part of this onboarding", 404);
      }

      const fetchedPolicy = await this.fetchGuestPolicy(policyType).catch((err: any) => {
        throw new Error(err?.message || `Could not fetch ${policyType} policy from policy service`);
      });
      if (fetchedPolicy) {
        return successResponse(res, {
          policyId: fetchedPolicy._id || fetchedPolicy.id || fetchedPolicy.policyType || policyType,
          policyType: fetchedPolicy.policyType || policyType,
          title: fetchedPolicy.title || this.fallbackPolicySnapshot(policyType).title,
          version: fetchedPolicy.version || 1,
          required: fetchedPolicy.isRequired !== false,
          content: fetchedPolicy.contentText || fetchedPolicy.content || fetchedPolicy.bodyText || fetchedPolicy.description || "",
          contentHtml: fetchedPolicy.contentHtml || fetchedPolicy.html || fetchedPolicy.bodyHtml || null,
          publishedAt: fetchedPolicy.publishedAt || null,
        });
      }
      return errorResponse(res, "Policy service returned an empty policy response", 502);
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  // PATCH /api/v1/hr/public/onboarding/:onboardingId/section
  // PUBLIC — candidate saves a section
  saveSection = async (req: Request, res: Response) => {
    try {
      const { onboardingId } = req.params;
      const { section, data } = req.body;

      if (!section || data === undefined) {
        return errorResponse(res, "section and data are required", 400);
      }

      const onboarding = await db.CandidateOnboarding.findOne({ where: { onboardingId } });
      if (!onboarding) {
        return errorResponse(res, "Onboarding session not found", 404);
      }

      if (onboarding.status === "SUBMITTED_FOR_REVIEW" || onboarding.status === "COMPLETED") {
        return errorResponse(res, "Onboarding has already been submitted", 400);
      }

      if (onboarding.status === "CANCELLED") {
        return errorResponse(res, "This onboarding session has been cancelled", 410);
      }
      if (this.isExpired(onboarding)) {
        return errorResponse(res, "This onboarding session has expired. Please contact HR for a new link.", 410);
      }

      const lockedEmail = onboarding.metadata?.assignedEmail;
      const sectionData = section === "personal_info" && lockedEmail ? { ...data, email: lockedEmail } : data;

      // Merge section data into candidateData
      const updatedCandidateData = {
        ...(onboarding.candidateData || {}),
        [section]: sectionData,
      };

      // Recalculate progress — overview always counts, resources counted via resourceResponses
      const enabledSections: string[] = onboarding.sections || [];
      const resources: any[] = onboarding.resources || [];
      const resourceResponses: any[] = onboarding.resourceResponses || [];
      const acceptanceRequired = resources.filter((r: any) => r.acceptanceRequired);
      const resourcesDone =
        resources.length === 0 ||
        acceptanceRequired.length === 0 ||
        acceptanceRequired.every((_: any, i: number) =>
          resourceResponses.some((rr: any) => rr.resourceIndex === i && rr.status)
        );

      const completedSections = enabledSections.filter((s: string) => {
        if (s === "review") return false;
        if (s === "overview") return true;
        if (s === "resources") return resourcesDone;
        const d = updatedCandidateData[s];
        return d && Object.keys(d).length > 0;
      });

      const trackable = enabledSections.filter((s: string) => s !== "review");
      const progress =
        trackable.length > 0
          ? Math.round((completedSections.length / trackable.length) * 100)
          : 0;

      // Update status to IN_PROGRESS if still pending
      const newStatus =
        onboarding.status === "PENDING_CANDIDATE_COMPLETION" ? "IN_PROGRESS" : onboarding.status;

      await onboarding.update({
        candidateData: updatedCandidateData,
        progress,
        status: newStatus,
      });

      successResponse(res, onboarding, "Section saved");
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  // PATCH /api/v1/hr/public/onboarding/:onboardingId/resources
  // PUBLIC — candidate responds to resources
  respondToResources = async (req: Request, res: Response) => {
    try {
      const { onboardingId } = req.params;
      const { responses } = req.body;

      if (!Array.isArray(responses)) {
        return errorResponse(res, "responses must be an array", 400);
      }

      const onboarding = await db.CandidateOnboarding.findOne({ where: { onboardingId } });
      if (!onboarding) {
        return errorResponse(res, "Onboarding session not found", 404);
      }

      if (onboarding.status === "SUBMITTED_FOR_REVIEW" || onboarding.status === "COMPLETED") {
        return errorResponse(res, "Onboarding has already been submitted", 400);
      }

      if (onboarding.status === "CANCELLED") {
        return errorResponse(res, "This onboarding session has been cancelled", 410);
      }
      if (this.isExpired(onboarding)) {
        return errorResponse(res, "This onboarding session has expired. Please contact HR for a new link.", 410);
      }

      const newStatus =
        onboarding.status === "PENDING_CANDIDATE_COMPLETION" ? "IN_PROGRESS" : onboarding.status;

      // Recalculate progress with updated resource responses
      const enabledSections: string[] = onboarding.sections || [];
      const resources: any[] = onboarding.resources || [];
      const candidateData: any = onboarding.candidateData || {};
      const acceptanceRequired = resources.filter((r: any) => r.acceptanceRequired);
      const resourcesDone =
        resources.length === 0 ||
        acceptanceRequired.length === 0 ||
        acceptanceRequired.every((_: any, i: number) =>
          responses.some((rr: any) => rr.resourceIndex === i && rr.status)
        );

      const completedSections = enabledSections.filter((s: string) => {
        if (s === "review") return false;
        if (s === "overview") return true;
        if (s === "resources") return resourcesDone;
        const d = candidateData[s];
        return d && Object.keys(d).length > 0;
      });

      const trackable = enabledSections.filter((s: string) => s !== "review");
      const progress =
        trackable.length > 0
          ? Math.round((completedSections.length / trackable.length) * 100)
          : 0;

      await onboarding.update({
        resourceResponses: responses,
        status: newStatus,
        progress,
      });

      successResponse(res, onboarding, "Resource responses saved");
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  // POST /api/v1/hr/public/onboarding/:onboardingId/submit
  // PUBLIC — candidate submits onboarding and creates their employee account
  submit = async (req: Request, res: Response) => {
    const transaction = await db.sequelize.transaction();
    try {
      const { onboardingId } = req.params;
      const { password } = req.body;

      const onboarding = await db.CandidateOnboarding.findOne({ where: { onboardingId }, transaction });
      if (!onboarding) {
        await transaction.rollback();
        return errorResponse(res, "Onboarding session not found", 404);
      }

      if (onboarding.status === "SUBMITTED_FOR_REVIEW" || onboarding.status === "COMPLETED") {
        await transaction.rollback();
        return successResponse(res, onboarding, "Onboarding already submitted");
      }

      if (onboarding.status === "CANCELLED") {
        await transaction.rollback();
        return errorResponse(res, "This onboarding session has been cancelled", 410);
      }
      if (this.isExpired(onboarding)) {
        await transaction.rollback();
        return errorResponse(res, "This onboarding session has expired. Please contact HR for a new link.", 410);
      }

      if (!password || password.length < 8) {
        await transaction.rollback();
        return errorResponse(res, "Password is required and must be at least 8 characters", 400);
      }

      const { businessId, candidateEmail, candidateName, candidateData, metadata, offerId } = onboarding;
      const personalInfo = (candidateData as any)?.personal_info || {};
      const emergencyContact = (candidateData as any)?.emergency_contact || {};
      const payroll = (candidateData as any)?.payroll || {};
      const submittedEmail = (metadata as any)?.assignedEmail || personalInfo.email || candidateEmail;

      // ── 1. Create or restore User account ──────────────────────────────────
      const passwordHash = await bcrypt.hash(password, 10);
      const nameParts = candidateName.trim().split(" ");
      const firstName = nameParts[0] || candidateName;
      const lastName = nameParts.slice(1).join(" ") || "";

      let targetUser = await db.User.findOne({
        where: { email: submittedEmail, businessId },
        transaction,
      });

      if (!targetUser) {
        // Check soft-deleted
        const deletedUser = await db.User.findOne({
          where: { email: submittedEmail, businessId },
          transaction,
          paranoid: false,
        });
        if (deletedUser) {
          await deletedUser.restore({ transaction });
          await deletedUser.update(
            {
              fullName: personalInfo.firstName
                ? `${personalInfo.firstName} ${personalInfo.lastName || ""}`.trim()
                : candidateName,
              password: passwordHash,
              phone: personalInfo.phone || null,
              status: "pending",
              registrationToken: deletedUser.registrationToken || randomUUID(),
            },
            { transaction }
          );
          targetUser = deletedUser;
        } else {
          targetUser = await db.User.create(
            {
              id: randomUUID(),
              businessId,
              fullName: personalInfo.firstName
                ? `${personalInfo.firstName} ${personalInfo.lastName || ""}`.trim()
                : candidateName,
              email: submittedEmail,
              password: passwordHash,
              phone: personalInfo.phone || null,
              status: "pending",
              registrationToken: randomUUID(),
            },
            { transaction }
          );
        }
      } else {
        // User already exists — update password and activate
        await targetUser.update(
          {
            password: passwordHash,
            status: "pending",
            phone: personalInfo.phone || targetUser.phone || null,
            registrationToken: targetUser.registrationToken || randomUUID(),
          },
          { transaction }
        );
      }

      // ── 3. Create EmployeeRecord (skip if already exists) ──────────────────
      const existingRecord = await db.EmployeeRecord.findOne({
        where: { userId: targetUser.id, businessId },
        transaction,
        paranoid: false,
      });

      // Resolve manager: offer's reportingManagerId → onboarding initializer → offer creator
      const offerLetter = await db.OfferLetter.findOne({
        where: { id: offerId, businessId },
        attributes: ["reportingManagerId", "createdById", "departmentId", "positionId"],
        transaction,
      });

      const resolvedManagerId =
        offerLetter?.reportingManagerId ||
        onboarding.initializedById ||
        offerLetter?.createdById ||
        null;

      const recordData = {
        businessId,
        userId: targetUser.id,
        employeeCode: `EMP-${Date.now().toString().slice(-5)}`,
        departmentId: offerLetter?.departmentId || null,
        positionId:   offerLetter?.positionId   || null,
        managerUserId: resolvedManagerId,
        employmentType: this.normalizeEmploymentType((metadata as any)?.employmentType),
        employmentStatus: "onboarding",
        hireDate: (metadata as any)?.startDate ? new Date((metadata as any).startDate) : new Date(),
        contractStartDate: (metadata as any)?.contractStartDate
          ? new Date((metadata as any).contractStartDate)
          : (metadata as any)?.startDate
            ? new Date((metadata as any).startDate)
            : null,
        salaryInfo: {
          baseSalary: (metadata as any)?.salary || null,
          currency: "ETB",
        },
        emergencyContact: {
          firstName: emergencyContact.firstName || emergencyContact.name || null,
          lastName: emergencyContact.lastName || null,
          phone: emergencyContact.phone || null,
          email: emergencyContact.email || null,
          city: emergencyContact.city || null,
          country: emergencyContact.country || null,
        },
        metadata: {
          dateOfBirth: personalInfo.dateOfBirth || null,
          gender: personalInfo.gender || null,
          nationality: personalInfo.nationality || null,
          city: personalInfo.city || null,
          country: personalInfo.country || null,
          address: personalInfo.address || null,
          bankDetails: payroll.bankName
            ? [
                {
                  bankName: payroll.bankName,
                  accountNumber: payroll.accountNumber,
                  accountName: payroll.accountName,
                  bankBranch: payroll.bankBranch,
                  taxId: payroll.taxId,
                },
              ]
            : [],
          onboardingId,
          offerId,
          assignedEmail: (metadata as any)?.assignedEmail || null,
          policyAcknowledgements: candidateData?.policies || {},
          resourceResponses: onboarding.resourceResponses || [],
        },
      };

      if (existingRecord) {
        if (existingRecord.deletedAt) await existingRecord.restore({ transaction });
        await existingRecord.update(recordData, { transaction });
      } else {
        await db.EmployeeRecord.create(recordData, { transaction });
      }

      // ── 4. Create or restore BusinessUserProfile ───────────────────────────
      const existingBP = await db.BusinessUserProfile.findOne({
        where: { userId: targetUser.id, businessId },
        transaction,
        paranoid: false,
      });

      const bpData = {
        businessId,
        userId: targetUser.id,
        employeeCode: recordData.employeeCode,
        departmentId: offerLetter?.departmentId || null,
        positionId:   offerLetter?.positionId   || null,
        workEmail: submittedEmail,
        workPhone: personalInfo.phone || null,
        employmentType: recordData.employmentType,
        joinedAt: recordData.hireDate,
        status: "pending",
        settings: {
          requestedRoleKey: "EMPLOYEE",
          onboardingId,
          offerId,
          assignedEmail: (metadata as any)?.assignedEmail || null,
          policyAcknowledgements: candidateData?.policies || {},
          resourceResponses: onboarding.resourceResponses || [],
          requiredPolicies: onboarding.requiredPolicies || [],
          inventoryItems: onboarding.resources || [],
          dateOfBirth: personalInfo.dateOfBirth || null,
          gender: personalInfo.gender || null,
          nationality: personalInfo.nationality || null,
          address: personalInfo.address || null,
          city: personalInfo.city || null,
          country: personalInfo.country || null,
        },
      };

      if (existingBP) {
        if (existingBP.deletedAt) await existingBP.restore({ transaction });
        await existingBP.update(bpData, { transaction });
      } else {
        await db.BusinessUserProfile.create(bpData, { transaction });
      }

      // ── 5. Mark onboarding as submitted ────────────────────────────────────
      await onboarding.update(
        {
          status: "SUBMITTED_FOR_REVIEW",
          submittedAt: new Date(),
          progress: 100,
        },
        { transaction }
      );

      await transaction.commit();

      successResponse(res, { onboarding, userId: targetUser.id }, "Onboarding submitted for HR review");
    } catch (e: any) {
      await transaction.rollback();
      errorResponse(res, e.message);
    }
  };

  // POST /api/v1/hr/public/onboarding/:onboardingId/upload
  // PUBLIC — candidate uploads a document file (no auth required)
  uploadDocument = async (req: Request, res: Response) => {
    try {
      const { onboardingId } = req.params;

      const onboarding = await db.CandidateOnboarding.findOne({ where: { onboardingId } });
      if (!onboarding) {
        return errorResponse(res, "Onboarding session not found", 404);
      }
      if (onboarding.status === "CANCELLED") {
        return errorResponse(res, "This onboarding session has been cancelled", 410);
      }
      if (this.isExpired(onboarding)) {
        return errorResponse(res, "This onboarding session has expired. Please contact HR for a new link.", 410);
      }
      if (!req.file) {
        return errorResponse(res, "No file uploaded", 400);
      }

      // Save a FileAsset record linked to the business (no userId since public)
      const asset = await db.FileAsset.create({
        id: randomUUID(),
        businessId: onboarding.businessId,
        uploadedByUserId: null,
        originalName: req.file.originalname,
        storedName: req.file.filename,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        storageProvider: "local",
        storagePath: req.file.path,
        moduleKey: "onboarding",
        status: "active",
        metadata: { onboardingId },
      });

      successResponse(
        res,
        {
          fileId: asset.id,
          originalName: asset.originalName,
          mimeType: asset.mimeType,
          sizeBytes: asset.sizeBytes,
          downloadUrl: `/api/v1/files/${asset.id}/download`,
        },
        "File uploaded",
        201
      );
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };
}


