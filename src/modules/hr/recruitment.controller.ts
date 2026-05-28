import type { Request, Response } from "express";
import { RecruitmentService } from "./recruitment.service";
import {
  errorResponse,
  successResponse,
  paginationResponse,
} from "../../utils/response";
import { AuditLogService } from "../../services/auditLog.service";
import { db } from "../../models";
import { Op } from "sequelize";
import { FileService } from "../file/file.service";

export class RecruitmentController {
  private service = new RecruitmentService();
  private fileService = new FileService();

  seedForms = async (req: Request, res: Response) => {
    await this.service.provisionForms(req.user!.businessId);
    successResponse(res, null, "Recruitment templates seeded.");
  };

  // Public Apply
  publicApply = async (req: Request, res: Response) => {
    try {
      const app = await this.service.publicApply(
        req.params.jobOpeningId,
        req.body,
      );
      successResponse(
        res,
        { jobApplicationId: app.id },
        "Application received.",
        201,
      );
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  // Public List Jobs
  publicListJobs = async (req: Request, res: Response) => {
    try {
      const jobs = await db.JobOpening.findAll({
        where: { status: "open" },
        order: [["createdAt", "DESC"]],
      });
      const mapped = jobs.map((o: any) => this.mapJobRequest(o));
      successResponse(res, mapped);
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  // Public Get Job
  publicGetJob = async (req: Request, res: Response) => {
    try {
      const job = await db.JobOpening.findOne({
        where: { id: req.params.id, status: "open" },
      });
      if (!job) return errorResponse(res, "Job not found", 404);

      // Note: Front-end triggers incrementView on its own
      successResponse(res, this.mapJobRequest(job));
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  publicUploadResume = async (req: Request, res: Response) => {
    try {
      if (!req.file) return errorResponse(res, "No file uploaded", 400);
      const job = await db.JobOpening.findByPk(req.params.jobOpeningId);
      if (!job) return errorResponse(res, "Job not found", 404);

      // Public upload — no authenticated user. uploadedByUserId is NULL.
      // The file is linked to the application via JobApplication.cvFileId after submission.
      const asset = await this.fileService.saveAssetRecord(
        job.businessId,
        null,
        req.file,
        { source: "public_resume", jobOpeningId: job.id },
      );

      const downloadUrl = `${req.protocol}://${req.get("host")}/api/files/${asset.id}/download`;
      successResponse(
        res,
        {
          fileId: asset.id,
          downloadUrl,
          originalName: asset.originalName,
        },
        "Resume uploaded successfully.",
        201,
      );
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  listOpenings = async (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit || 20);
      const offset = Number(req.query.offset || 0);
      const q: any = { businessId: req.user!.businessId };
      const result = await db.JobOpening.findAndCountAll({
        where: q,
        limit,
        offset,
      });
      paginationResponse(
        res,
        result.rows,
        result.count,
        offset / limit + 1,
        limit,
      );
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  listApplications = async (req: Request, res: Response) => {
    try {
      const applications = await db.JobApplication.findAll({
        where: { businessId: req.user!.businessId },
        order: [["createdAt", "DESC"]],
      });
      successResponse(res, applications);
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  createOpening = async (req: Request, res: Response) => {
    try {
      const incoming = { ...(req.body || {}) };
      const metadata = { ...(incoming.metadata || {}) };
      if (!metadata.approvalStatus) metadata.approvalStatus = "pending";
      incoming.metadata = metadata;

      const opening = await db.JobOpening.create({
        ...incoming,
        businessId: req.user!.businessId,
        requestedByUserId: req.user!.id,
      });
      await AuditLogService.log(
        "CREATED_JOB_OPENING",
        "hr_job_openings",
        String(opening.id),
        null,
        {},
        req,
      );
      successResponse(res, opening, "Job opening defined.", 201);
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  private mapJobRequest(o: any) {
    const m = o.metadata || {};
    const approvalStatus = (m.approvalStatus || "pending")
      .toString()
      .toLowerCase();
    const mappedStatus =
      approvalStatus === "approved"
        ? "approved"
        : approvalStatus === "declined"
          ? "declined"
          : "pending";

    const employmentType = (
      o.employmentType ||
      m.employmentType ||
      "Full-time"
    ).toString();
    const normalizedType = employmentType.toLowerCase().includes("part")
      ? "Part-time"
      : employmentType.toLowerCase().includes("remote")
        ? "Remote"
        : employmentType.toLowerCase().includes("contract")
          ? "Contract"
          : "Full-time";

    const priority = (o.priority || m.priority || "medium")
      .toString()
      .toLowerCase();
    const normalizedPriority =
      priority === "high" ? "High" : priority === "low" ? "Low" : "Medium";

    const dept = (o.department || m.department || "").toString() || "—";
    const requestedAt = o.createdAt
      ? new Date(o.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "";

    return {
      id: o.id,
      title: o.title,
      department: dept,
      type: normalizedType,
      positions: Number(o.headcount || 1),
      requestedAt: o.createdAt,
      requestedDate: requestedAt,
      priority: normalizedPriority,
      status: mappedStatus,
      isPosted: o.status === "open",
      views: Number(o.views || 0),
      approvals: m.approvals || [],
      overview:
        o.description || m.overview || m.summary || "No overview provided.",
      requirements: m.requirements || m.requiredSkills || [],
      qualifications: m.qualifications || m.preferredSkills || [],
      importance: m.importance || m.urgency || "Standard business requirement.",
      dueDate: m.deadline || m.neededByDate || "TBD",
      expectedDate: m.expectedDate || m.neededByDate || "TBD",
      requestedBy: {
        name: m.hiringManager || "Platform User",
        dept: dept,
        avatar: (m.hiringManager || "U")[0].toUpperCase(),
      },
      applicationFields: m.applicationFields || m.applicantFields || {},
    };
  }

  incrementJobView = async (req: Request, res: Response) => {
    try {
      const job = await db.JobOpening.findByPk(req.params.id);
      if (!job) return errorResponse(res, "Job not found", 404);
      await job.increment("views", { by: 1 });
      successResponse(res, null, "View counted.");
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  scheduleInterview = async (req: Request, res: Response) => {
    try {
      const {
        jobApplicationId,
        interviewAt,
        duration,
        sessions,
        type,
        venue,
        department,
        panel,
        questions,
        additionalNotes,
      } = req.body;

      const interview = await db.Interview.create({
        businessId: req.user!.businessId,
        jobApplicationId,
        scheduledByUserId: req.user!.id,
        interviewAt,
        duration,
        sessions,
        type,
        venue,
        department,
        panel,
        questions,
        additionalNotes,
        status: "scheduled",
      });

      await db.JobApplication.update(
        { stage: "interview" },
        { where: { id: jobApplicationId, businessId: req.user!.businessId } },
      );

      await AuditLogService.log(
        "SCHEDULED_INTERVIEW",
        "hr_interviews",
        String(interview.id),
        null,
        { jobApplicationId },
        req,
      );
      successResponse(
        res,
        interview,
        "Interview scheduled and candidate advanced.",
        201,
      );
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  listInterviews = async (req: Request, res: Response) => {
    try {
      const interviews = await db.Interview.findAll({
        where: { businessId: req.user!.businessId },
        order: [["interviewAt", "ASC"]],
      });
      successResponse(res, interviews);
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  listJobRequests = async (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit || 50);
      const page = Number(req.query.page || 1);
      const offset = (page - 1) * limit;
      const status = String(req.query.status || "").toLowerCase(); // pending|approved|declined
      const onlyApprovedByMe =
        String(req.query.approvedByMe || "").toLowerCase() === "true";
      const onlyApprovedByOthers =
        String(req.query.approvedByOthers || "").toLowerCase() === "true";
      const includePublished =
        String(req.query.includePublished || "").toLowerCase() === "true";

      const where: any = {
        businessId: req.user!.businessId,
      };

      if (!includePublished) {
        where.status = { [Op.ne]: "open" };
      }

      const andFilters: any[] = [];

      if (status) {
        andFilters.push(
          db.sequelize.where(
            db.sequelize.json("metadata.approvalStatus") as any,
            status,
          ),
        );
      }

      if (onlyApprovedByMe) {
        andFilters.push(
          db.sequelize.literal(
            `EXISTS (SELECT 1 FROM jsonb_array_elements(metadata->'approvals') AS elem WHERE (elem->>'userId')::uuid = '${req.user!.id}'::uuid)`,
          ),
        );
      } else if (onlyApprovedByOthers) {
        andFilters.push(
          db.sequelize.literal(`jsonb_array_length(metadata->'approvals') > 0`),
        );
        andFilters.push(
          db.sequelize.literal(
            `NOT EXISTS (SELECT 1 FROM jsonb_array_elements(metadata->'approvals') AS elem WHERE (elem->>'userId')::uuid = '${req.user!.id}'::uuid)`,
          ),
        );
      }

      if (andFilters.length > 0) {
        where[Op.and] = andFilters;
      }

      const result = await db.JobOpening.findAndCountAll({
        where,
        limit,
        offset,
        order: [["createdAt", "DESC"]],
      });

      const rows = (result.rows || []).map((o: any) => this.mapJobRequest(o));

      paginationResponse(res, rows, result.count, page, limit);
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  approveJobRequest = async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const opening = await db.JobOpening.findOne({
        where: { id, businessId: req.user!.businessId },
      });
      if (!opening) return errorResponse(res, "Not found", 404);

      const metadata = JSON.parse(JSON.stringify(opening.metadata || {}));
      if (!metadata.approvals) metadata.approvals = [];

      const userRoles = req.user!.roles || [];
      let roleKey = "";
      if (userRoles.includes("HR_MANAGER")) roleKey = "HR_MANAGER";
      else if (userRoles.includes("BUSINESS_ADMIN")) roleKey = "BUSINESS_ADMIN";
      else if (userRoles.includes("FINANCE_MANAGER"))
        roleKey = "FINANCE_MANAGER";

      if (!roleKey)
        return errorResponse(res, "User does not have an approving role", 403);

      const already = (metadata.approvals || []).find(
        (a: any) => a.role === roleKey,
      );
      if (already) return errorResponse(res, `Already approved as ${roleKey}`);

      metadata.approvals.push({
        role: roleKey,
        userId: req.user!.id,
        approvedAt: new Date().toISOString(),
      });

      const rolesInApprovals = metadata.approvals.map((a: any) => a.role);
      const isFullyApproved = [
        "HR_MANAGER",
        "BUSINESS_ADMIN",
        "FINANCE_MANAGER",
      ].every((r) => rolesInApprovals.includes(r));

      if (isFullyApproved) {
        metadata.approvalStatus = "approved";
        opening.status = "approved";
      } else {
        metadata.approvalStatus = "pending";
      }

      opening.metadata = metadata;
      opening.changed("metadata", true);
      await opening.save();

      await AuditLogService.log(
        "APPROVED_JOB_REQUEST",
        "hr_job_openings",
        String(opening.id),
        null,
        { role: roleKey, approvedByUserId: req.user!.id },
        req,
      );
      successResponse(
        res,
        opening,
        isFullyApproved ? "Fully Approved" : `Approved as ${roleKey}`,
      );
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  publishJob = async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const opening = await db.JobOpening.findOne({
        where: { id, businessId: req.user!.businessId },
      });
      if (!opening) return errorResponse(res, "Not found", 404);

      const m = opening.metadata || {};
      const isApproved = m.approvalStatus === "approved";

      // Check both column status and metadata status for backwards compatibility
      if (opening.status !== "approved" && !isApproved) {
        return errorResponse(
          res,
          "Job must be fully approved before posting",
          400,
        );
      }

      opening.status = "open";
      await opening.save();

      await AuditLogService.log(
        "PUBLISHED_JOB",
        "hr_job_openings",
        String(opening.id),
        null,
        {},
        req,
      );
      successResponse(res, opening, "Job published successfully");
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  declineJobRequest = async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const opening = await db.JobOpening.findOne({
        where: { id, businessId: req.user!.businessId },
      });
      if (!opening) return errorResponse(res, "Not found", 404);

      const metadata = JSON.parse(JSON.stringify(opening.metadata || {}));
      metadata.approvalStatus = "declined";
      metadata.declinedByUserId = req.user!.id;
      metadata.declinedAt = new Date().toISOString();
      metadata.declineReason = req.body?.reason || null;
      metadata.approvals = [];

      opening.status = "draft";
      opening.metadata = metadata;
      opening.changed("metadata", true);
      await opening.save();

      await AuditLogService.log(
        "DECLINED_JOB_REQUEST",
        "hr_job_openings",
        String(opening.id),
        null,
        { declinedByUserId: req.user!.id },
        req,
      );
      successResponse(res, opening, "Declined");
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  advanceApplicant = async (req: Request, res: Response) => {
    try {
      const { stage } = req.body;
      const result = await this.service.advanceApplicant(
        req.params.id,
        req.user!.businessId,
        stage,
      );
      await AuditLogService.log(
        "ADVANCED_APPLICANT",
        "hr_job_applications",
        String(result.id),
        null,
        { stage },
        req,
      );
      successResponse(res, result);
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  createTemplate = async (req: Request, res: Response) => {
    try {
      const template = await db.RecruitmentTemplate.create({
        ...req.body,
        businessId: req.user!.businessId,
        createdByUserId: req.user!.id,
      });
      await AuditLogService.log(
        "CREATED_RECRUITMENT_TEMPLATE",
        "hr_recruitment_templates",
        String(template.id),
        null,
        {},
        req,
      );
      successResponse(res, template, "Recruitment template saved.", 201);
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  listTemplates = async (req: Request, res: Response) => {
    try {
      const limit = Number(req.query.limit || 50);
      const offset = Number(req.query.offset || 0);
      const templates = await db.RecruitmentTemplate.findAndCountAll({
        where: { businessId: req.user!.businessId },
        limit,
        offset,
        order: [["createdAt", "DESC"]],
      });
      paginationResponse(
        res,
        templates.rows,
        templates.count,
        Math.floor(offset / limit) + 1,
        limit,
      );
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };
}
