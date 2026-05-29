import { Request, Response } from "express";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import path from "path";
import fs from "fs";
import { db } from "../../models";
import { errorResponse, successResponse } from "../../utils/response";
import { sendOnboardingInviteEmail } from "../../utils/onboardingMailer";

export class CandidateOnboardingController {
  // POST /api/v1/hr/onboarding/initialize
  // Auth required — HR_MANAGER or BUSINESS_ADMIN
  initialize = async (req: Request, res: Response) => {
    try {
      const businessId = req.user!.businessId;
      const { offerId, sections, resources, requiredDocuments, requiredPolicies } = req.body;

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
        const onboardingUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/career/onboarding/${existing.onboardingId}`;

        // Resend the invite email
        const business = await db.Business.findByPk(businessId, { attributes: ["name"] }).catch(() => null);
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

      const onboarding = await db.CandidateOnboarding.create({
        onboardingId,
        businessId,
        offerId,
        candidateEmail: offer.candidateEmail,
        candidateName: offer.candidateName,
        status: "PENDING_CANDIDATE_COMPLETION",
        sections: sections && sections.length > 0 ? sections : defaultSections,
        resources: resources || [],
        requiredDocuments: requiredDocuments || [],
        requiredPolicies: requiredPolicies || [],
        candidateData: {},
        resourceResponses: [],
        progress: 0,
        initializedById: req.user!.id,
        metadata: {
          salary: offer.salary,
          startDate: offer.startDate,
          employmentType: offer.employmentType,
          workLocation: offer.workLocation,
          reportingManager: offer.reportingManager,
        },
      });

      // Mark offer as onboarding initialized
      await db.OfferLetter.update(
        { onboardingInitialized: true },
        { where: { id: offerId } }
      );

      const onboardingUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/career/onboarding/${onboardingId}`;

      // Send onboarding invite email to candidate (fire-and-forget)
      const business = await db.Business.findByPk(businessId, { attributes: ["name"] }).catch(() => null);
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

      successResponse(res, onboarding);
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

      // Merge section data into candidateData
      const updatedCandidateData = {
        ...(onboarding.candidateData || {}),
        [section]: data,
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

      if (!password || password.length < 8) {
        await transaction.rollback();
        return errorResponse(res, "Password is required and must be at least 8 characters", 400);
      }

      const { businessId, candidateEmail, candidateName, candidateData, metadata, offerId } = onboarding;
      const personalInfo = (candidateData as any)?.personal_info || {};
      const emergencyContact = (candidateData as any)?.emergency_contact || {};
      const payroll = (candidateData as any)?.payroll || {};

      // ── 1. Create or restore User account ──────────────────────────────────
      const passwordHash = await bcrypt.hash(password, 10);
      const nameParts = candidateName.trim().split(" ");
      const firstName = nameParts[0] || candidateName;
      const lastName = nameParts.slice(1).join(" ") || "";

      let targetUser = await db.User.findOne({
        where: { email: candidateEmail, businessId },
        transaction,
      });

      if (!targetUser) {
        // Check soft-deleted
        const deletedUser = await db.User.findOne({
          where: { email: candidateEmail, businessId },
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
              status: "active",
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
              email: candidateEmail,
              password: passwordHash,
              phone: personalInfo.phone || null,
              status: "active",
            },
            { transaction }
          );
        }
      } else {
        // User already exists — update password and activate
        await targetUser.update(
          {
            password: passwordHash,
            status: "active",
            phone: personalInfo.phone || targetUser.phone || null,
          },
          { transaction }
        );
      }

      // ── 2. Assign EMPLOYEE role ─────────────────────────────────────────────
      const employeeRole =
        (await db.Role.findOne({ where: { businessId, key: "EMPLOYEE" }, transaction })) ||
        (await db.Role.findOne({ where: { businessId: null, key: "EMPLOYEE" }, transaction }));
      if (employeeRole) {
        await targetUser.setRoles([employeeRole], { transaction });
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
        employmentType: (metadata as any)?.employmentType || "full_time",
        employmentStatus: "active",   // active so they appear in org chart
        hireDate: (metadata as any)?.startDate ? new Date((metadata as any).startDate) : new Date(),
        salaryInfo: {
          baseSalary: (metadata as any)?.salary || null,
          currency: "ETB",
        },
        emergencyContact: {
          name: emergencyContact.name || null,
          relationship: emergencyContact.relationship || null,
          phone: emergencyContact.phone || null,
          email: emergencyContact.email || null,
          address: emergencyContact.address || null,
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
        workEmail: candidateEmail,
        workPhone: personalInfo.phone || null,
        employmentType: recordData.employmentType,
        joinedAt: recordData.hireDate,
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

      successResponse(res, { onboarding, userId: targetUser.id }, "Onboarding submitted and employee account created");
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
