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
import crypto from "crypto";
import { sendInterviewInviteEmail, sendInterviewerNotificationEmail } from "../../utils/interviewMailer";
import { getSocketService } from "../../services/realtime/socket";
import { InternalNotifier } from "../notification/notification.service";

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

  // Public List Jobs — filtered by business slug
  publicListJobs = async (req: Request, res: Response) => {
    try {
      const { businessSlug } = req.params;

      // Find business by slug, include branding
      const business = await db.Business.findOne({
        where: { slug: businessSlug },
        attributes: ['id', 'name', 'slug', 'email'],
        include: [
          {
            model: db.BusinessBranding,
            as: 'BusinessBranding',
            attributes: ['companyName', 'tagline', 'logoFileId', 'primaryColor', 'accentColor'],
            required: false,
          },
        ],
      });

      if (!business) {
        return errorResponse(res, 'Business not found', 404);
      }

      const jobs = await db.JobOpening.findAll({
        where: { businessId: business.id, status: "open" },
        order: [["createdAt", "DESC"]],
      });
      const mapped = jobs.map((o: any) => this.mapJobRequest(o));

      const branding = business.BusinessBranding;
      const businessData = {
        id: business.id,
        name: branding?.companyName || business.name,
        slug: business.slug,
        tagline: branding?.tagline || null,
        logoFileId: branding?.logoFileId || null,
        primaryColor: branding?.primaryColor || '#3b82f6',
        accentColor: branding?.accentColor || '#3b82f6',
        email: business.email,
      };

      successResponse(res, { business: businessData, jobs: mapped });
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  // Public Get Job
  publicGetJob = async (req: Request, res: Response) => {
    try {
      const { businessSlug, id } = req.params;
      
      // Find business by slug
      const business = await db.Business.findOne({
        where: { slug: businessSlug },
        attributes: ['id'],
      });
      
      if (!business) {
        return errorResponse(res, 'Business not found', 404);
      }

      const job = await db.JobOpening.findOne({
        where: { 
          id, 
          businessId: business.id,
          status: "open" 
        },
      });
      if (!job) return errorResponse(res, "Job not found", 404);

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

      // Enrich each application with average skill rating from all interviewers' notes
      const appIds = applications.map((a: any) => a.id);

      // Get all interviews for these applications, then get their notes
      const interviews = appIds.length > 0
        ? await db.Interview.findAll({
            where: { jobApplicationId: appIds, businessId: req.user!.businessId },
            attributes: ["id", "jobApplicationId"],
          })
        : [];

      const interviewIds = (interviews as any[]).map((iv: any) => iv.id);
      const interviewAppMap: Record<string, string> = {};
      (interviews as any[]).forEach((iv: any) => { interviewAppMap[iv.id] = iv.jobApplicationId; });

      const notes = interviewIds.length > 0
        ? await db.InterviewerNote.findAll({
            where: { interviewId: interviewIds },
            attributes: ["interviewId", "skillRatings", "candidateScore"],
          })
        : [];

      // Build map: jobApplicationId → average rating across all notes
      // Priority: per-skill actualRatings (1-5 scale); fallback to candidateScore (0-100 → 1-5)
      const ratingMap: Record<string, { sum: number; count: number }> = {};
      for (const note of notes as any[]) {
        const appId = interviewAppMap[note.interviewId];
        if (!appId) continue;

        // Try skill ratings first
        const skillRatings: number[] = (note.skillRatings || [])
          .map((r: any) => r.actualRating)
          .filter((r: any) => r != null && typeof r === "number");

        let ratingValue: number | null = null;

        if (skillRatings.length > 0) {
          // Average of per-skill ratings (already on 1-5 scale)
          ratingValue = skillRatings.reduce((s: number, r: number) => s + r, 0) / skillRatings.length;
        } else if (note.candidateScore != null && typeof note.candidateScore === "number") {
          // Convert candidateScore (0-100) to 1-5 scale
          ratingValue = (note.candidateScore / 100) * 5;
        }

        if (ratingValue == null) continue;
        if (!ratingMap[appId]) ratingMap[appId] = { sum: 0, count: 0 };
        ratingMap[appId].sum += ratingValue;
        ratingMap[appId].count += 1;
      }

      const enriched = applications.map((a: any) => {
        const entry = ratingMap[a.id];
        const avgSkillRating = entry
          ? Math.round((entry.sum / entry.count) * 10) / 10
          : null;
        return { ...a.toJSON(), avgSkillRating };
      });

      successResponse(res, enriched);
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

    // Normalize to arrays — metadata may store these as strings or other types
    const toArray = (val: any): string[] => {
      if (Array.isArray(val)) return val;
      if (typeof val === "string" && val.trim()) return val.split(/[,\n]+/).map((s: string) => s.trim()).filter(Boolean);
      return [];
    };

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
      postingStatus: o.status,
      isPosted: ["open", "active", "published"].includes(o.status),
      views: Number(o.views || 0),
      approvals: m.approvals || [],
      overview:
        o.description || m.overview || m.summary || "No overview provided.",
      requirements: toArray(m.requirements || m.requiredSkills),
      qualifications: toArray(m.qualifications || m.preferredSkills),
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
      const { businessSlug, id } = req.params;
      
      // Find business by slug
      const business = await db.Business.findOne({
        where: { slug: businessSlug },
        attributes: ['id'],
      });
      
      if (!business) {
        return errorResponse(res, 'Business not found', 404);
      }

      const job = await db.JobOpening.findOne({
        where: { 
          id, 
          businessId: business.id 
        },
      });
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
        totalSessions,
        type,
        venue,
        department,
        panel,
        questions,
        additionalNotes,
        interviewerUserId,
        skills, // [{ skillId, requiredRating }]
      } = req.body;

      // Validate application exists and belongs to this business
      const application = await db.JobApplication.findOne({
        where: { id: jobApplicationId, businessId: req.user!.businessId },
        include: [{ model: db.JobOpening }],
      });
      if (!application) return errorResponse(res, "Application not found", 404);

      // Generate acceptance token
      const acceptanceToken = crypto.randomBytes(32).toString("hex");

      const interview = await db.Interview.create({
        businessId: req.user!.businessId,
        jobApplicationId,
        scheduledByUserId: req.user!.id,
        interviewerUserId: interviewerUserId || null,
        interviewAt,
        duration: duration || 60,
        totalSessions: totalSessions || 1,
        currentSession: 1,
        type: type || "Face to Face",
        venue,
        department,
        panel: panel || [],
        questions: questions || [],
        additionalNotes,
        status: "pending_acceptance", // wait for candidate to accept
        acceptanceToken,
      });

      // Add skills if provided
      if (skills && Array.isArray(skills) && skills.length > 0) {
        const skillRecords = skills.map((s: any) => ({
          businessId: req.user!.businessId,
          interviewId: interview.id,
          skillId: s.skillId,
          requiredRating: s.requiredRating,
        }));
        await db.InterviewSkill.bulkCreate(skillRecords);
      }

      // Advance application stage
      await db.JobApplication.update(
        { stage: "interview" },
        { where: { id: jobApplicationId, businessId: req.user!.businessId } },
      );

      // Build acceptance/decline URLs
      const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const acceptUrl = `${baseUrl}/interview/respond?token=${acceptanceToken}&action=accept`;
      const declineUrl = `${baseUrl}/interview/respond?token=${acceptanceToken}&action=decline`;

      // Send email to candidate
      const candidateEmail = application.email;
      const candidateName = application.fullName || "Candidate";
      const jobTitle = application.JobOpening?.title || "the position";

      if (candidateEmail) {
        sendInterviewInviteEmail({
          candidateName,
          candidateEmail,
          jobTitle,
          interviewAt: new Date(interviewAt),
          duration: duration || 60,
          type: type || "Face to Face",
          venue,
          acceptUrl,
          declineUrl,
        }).catch((err) => console.error("[InterviewMailer] Failed to send invite:", err));
      }

      // Notify assigned interviewer via WebSocket + email + DB notification
      if (interviewerUserId) {
        // WebSocket (real-time)
        try {
          const socketService = getSocketService();
          socketService.notifyUser(interviewerUserId, "interview:assigned", {
            interviewId: interview.id,
            candidateName,
            jobTitle,
            interviewAt,
            message: `You have been assigned to interview ${candidateName} for ${jobTitle}`,
          });
        } catch {
          // Socket not initialized yet — skip silently
        }

        // DB notification (shows in bell)
        InternalNotifier.send({
          businessId: req.user!.businessId,
          recipientUserId: interviewerUserId,
          senderUserId: req.user!.id,
          moduleKey: "recruitment",
          type: "interview_assigned",
          title: "Interview Assignment",
          message: `You have been assigned to interview ${candidateName} for ${jobTitle} on ${new Date(interviewAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`,
          entityType: "interview",
          entityId: interview.id,
          priority: "high",
        }).catch((err: any) => console.error("[Notifier] Failed to save interviewer notification:", err));

        // Email
        const interviewer = await db.User.findByPk(interviewerUserId);
        if (interviewer?.email) {
          sendInterviewerNotificationEmail({
            interviewerName: interviewer.fullName,
            interviewerEmail: interviewer.email,
            candidateName,
            jobTitle,
            interviewAt: new Date(interviewAt),
            duration: duration || 60,
            type: type || "Face to Face",
            venue,
          }).catch((err) => console.error("[InterviewMailer] Failed to send interviewer notification:", err));
        }
      }

      // Notify panel members via WebSocket + DB notification
      if (panel && Array.isArray(panel)) {
        const panelUserIds = panel
          .filter((p: any) => p.userId)
          .map((p: any) => p.userId);

        if (panelUserIds.length > 0) {
          // WebSocket
          try {
            const socketService = getSocketService();
            socketService.notifyUsers(panelUserIds, "interview:assigned", {
              interviewId: interview.id,
              candidateName,
              jobTitle,
              interviewAt,
              message: `You have been added to the interview panel for ${candidateName}`,
            });
          } catch {
            // Socket not initialized yet — skip silently
          }

          // DB notifications for each panel member
          const panelNotifications = panelUserIds
            .filter((uid: string) => uid !== interviewerUserId) // avoid duplicate if lead is also in panel array
            .map((uid: string) =>
              InternalNotifier.send({
                businessId: req.user!.businessId,
                recipientUserId: uid,
                senderUserId: req.user!.id,
                moduleKey: "recruitment",
                type: "interview_panel_assigned",
                title: "Added to Interview Panel",
                message: `You have been added to the interview panel for ${candidateName} (${jobTitle}).`,
                entityType: "interview",
                entityId: interview.id,
                priority: "normal",
              }).catch((err: any) => console.error("[Notifier] Failed to save panel notification:", err))
            );
          await Promise.allSettled(panelNotifications);
        }
      }

      await AuditLogService.log(
        "SCHEDULED_INTERVIEW",
        "hr_interviews",
        String(interview.id),
        null,
        { jobApplicationId },
        req,
      );

      // Return interview with skills
      const fullInterview = await db.Interview.findByPk(interview.id, {
        include: [
          {
            model: db.InterviewSkill,
            as: "skills",
            include: [{ model: db.Skill }],
          },
        ],
      });

      successResponse(res, fullInterview, "Interview scheduled. Candidate invitation sent.", 201);
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  listInterviews = async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const isHR = user.roles?.includes("HR_MANAGER") || user.roles?.includes("BUSINESS_ADMIN");

      // Regular employees only see interviews they're assigned to
      const where: any = { businessId: user.businessId };
      if (!isHR) {
        where[Op.or] = [
          { interviewerUserId: user.id },
          db.sequelize.literal(
            `EXISTS (SELECT 1 FROM jsonb_array_elements("Interview"."panel") AS p WHERE (p->>'userId') = '${user.id}')`
          ),
        ];
      }

      const interviews = await db.Interview.findAll({
        where,
        order: [["interviewAt", "ASC"]],
        include: [
          {
            model: db.InterviewSkill,
            as: "skills",
            include: [{ model: db.Skill }],
          },
          {
            model: db.JobApplication,
            include: [{ model: db.JobOpening }],
          },
        ],
      });
      successResponse(res, interviews);
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  getInterview = async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const isHR = user.roles?.includes("HR_MANAGER") || user.roles?.includes("BUSINESS_ADMIN");

      const interview = await db.Interview.findOne({
        where: { id: req.params.id, businessId: user.businessId },
        include: [
          {
            model: db.InterviewSkill,
            as: "skills",
            include: [{ model: db.Skill }],
          },
          {
            model: db.JobApplication,
            include: [{ model: db.JobOpening }],
          },
        ],
      });

      if (!interview) return errorResponse(res, "Interview not found", 404);

      // Non-HR users can only view interviews they're assigned to
      if (!isHR) {
        const panel = interview.panel || [];
        const isAssigned =
          interview.interviewerUserId === user.id ||
          panel.some((p: any) => p.userId === user.id);
        if (!isAssigned) return errorResponse(res, "Access denied", 403);
      }

      successResponse(res, interview);
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  updateInterview = async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const isHR = user.roles?.includes("HR_MANAGER") || user.roles?.includes("BUSINESS_ADMIN");

      const interview = await db.Interview.findOne({
        where: { id: req.params.id, businessId: user.businessId },
      });
      if (!interview) return errorResponse(res, "Interview not found", 404);

      // Non-HR can only update questions/skills if they're the assigned interviewer
      if (!isHR) {
        const panel = interview.panel || [];
        const isAssigned =
          interview.interviewerUserId === user.id ||
          panel.some((p: any) => p.userId === user.id);
        if (!isAssigned) return errorResponse(res, "Access denied", 403);
      }

      const { questions, skills, additionalNotes, feedback, score } = req.body;

      // HR can update everything; interviewers can update questions, skills, feedback, score
      const updates: any = {};
      if (questions !== undefined) updates.questions = questions;
      if (additionalNotes !== undefined) updates.additionalNotes = additionalNotes;
      if (feedback !== undefined) updates.feedback = feedback;
      if (score !== undefined) updates.score = score;

      if (isHR) {
        const { interviewAt, duration, type, venue, department, panel: newPanel, totalSessions, interviewerUserId } = req.body;
        if (interviewAt !== undefined) updates.interviewAt = interviewAt;
        if (duration !== undefined) updates.duration = duration;
        if (type !== undefined) updates.type = type;
        if (venue !== undefined) updates.venue = venue;
        if (department !== undefined) updates.department = department;
        if (newPanel !== undefined) updates.panel = newPanel;
        if (totalSessions !== undefined) updates.totalSessions = totalSessions;
        if (interviewerUserId !== undefined) updates.interviewerUserId = interviewerUserId;
      }

      await interview.update(updates);

      // Update skills if provided
      if (skills !== undefined && Array.isArray(skills)) {
        // Remove existing skills and re-insert
        await db.InterviewSkill.destroy({ where: { interviewId: interview.id } });
        if (skills.length > 0) {
          await db.InterviewSkill.bulkCreate(
            skills.map((s: any) => ({
              businessId: user.businessId,
              interviewId: interview.id,
              skillId: s.skillId,
              requiredRating: s.requiredRating,
              actualRating: s.actualRating ?? null,
            }))
          );
        }
      }

      // Notify via WebSocket
      try {
        const socketService = getSocketService();
        socketService.notifyInterview(interview.id, "interview:updated", {
          interviewId: interview.id,
          updatedBy: user.fullName,
        });
      } catch { /* socket not ready */ }

      const updated = await db.Interview.findByPk(interview.id, {
        include: [
          {
            model: db.InterviewSkill,
            as: "skills",
            include: [{ model: db.Skill }],
          },
        ],
      });

      successResponse(res, updated, "Interview updated.");
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  completeSession = async (req: Request, res: Response) => {
    try {
      const user = req.user!;
      const interview = await db.Interview.findOne({
        where: { id: req.params.id, businessId: user.businessId },
        include: [
          {
            model: db.JobApplication,
            include: [{ model: db.JobOpening }],
          },
        ],
      });
      if (!interview) return errorResponse(res, "Interview not found", 404);

      if (interview.status === "cancelled") {
        return errorResponse(res, "Cannot complete a cancelled interview", 400);
      }

      // Only the interview leader (interviewerUserId) or the person who scheduled it
      // can advance sessions. Panel members can submit their own notes but cannot
      // move the interview forward.
      const isLeader =
        interview.interviewerUserId === user.id ||
        interview.scheduledByUserId === user.id;
      const isHR =
        user.roles?.includes("HR_MANAGER") ||
        user.roles?.includes("BUSINESS_ADMIN") ||
        (user.permissions || []).includes("interview.schedule");

      if (!isLeader && !isHR) {
        return errorResponse(
          res,
          "Only the interview leader can complete a session",
          403,
        );
      }

      const { feedback, score, skillRatings } = req.body;

      // Update skill actual ratings if provided
      if (skillRatings && Array.isArray(skillRatings)) {
        for (const sr of skillRatings) {
          await db.InterviewSkill.update(
            { actualRating: sr.actualRating },
            { where: { interviewId: interview.id, skillId: sr.skillId } }
          );
        }
      }

      const nextSession = (interview.currentSession || 1) + 1;
      const allSessionsDone = nextSession > (interview.totalSessions || 1);

      if (allSessionsDone) {
        // All sessions complete — advance to offer stage
        await interview.update({
          status: "completed",
          feedback: feedback || interview.feedback,
          score: score ?? interview.score,
          currentSession: interview.totalSessions,
        });

        await db.JobApplication.update(
          { stage: "offer" },
          { where: { id: interview.jobApplicationId, businessId: user.businessId } }
        );

        // Notify HR via WebSocket
        try {
          const socketService = getSocketService();
          socketService.notifyBusiness(user.businessId, "interview:completed", {
            interviewId: interview.id,
            candidateName: interview.JobApplication?.fullName || "Candidate",
            jobTitle: interview.JobApplication?.JobOpening?.title || "Position",
            message: "All interview sessions completed. Candidate advanced to offer stage.",
          });
        } catch { /* socket not ready */ }

        // DB notification to scheduler
        InternalNotifier.send({
          businessId: user.businessId,
          recipientUserId: interview.scheduledByUserId,
          senderUserId: user.id,
          moduleKey: "recruitment",
          type: "interview_completed",
          title: "Interview Completed",
          message: `All sessions for ${interview.JobApplication?.fullName || "Candidate"} (${interview.JobApplication?.JobOpening?.title || "Position"}) are done. Candidate advanced to offer stage.`,
          entityType: "interview",
          entityId: interview.id,
          priority: "high",
        }).catch(() => {});

        successResponse(res, interview, "All sessions completed. Candidate advanced to offer stage.");
      } else {
        // More sessions remaining
        await interview.update({
          currentSession: nextSession,
          feedback: feedback || interview.feedback,
          score: score ?? interview.score,
        });

        try {
          const socketService = getSocketService();
          socketService.notifyInterview(interview.id, "interview:session_completed", {
            interviewId: interview.id,
            currentSession: nextSession - 1,
            totalSessions: interview.totalSessions,
            nextSession,
          });
        } catch { /* socket not ready */ }

        successResponse(res, interview, `Session ${nextSession - 1} completed. ${interview.totalSessions - nextSession + 1} session(s) remaining.`);
      }
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  respondToInterview = async (req: Request, res: Response) => {
    try {
      const { token, action } = req.query as { token: string; action: string };

      if (!token || !action) {
        return errorResponse(res, "Token and action are required", 400);
      }

      const interview = await db.Interview.findOne({
        where: { acceptanceToken: token },
        paranoid: false, // find even if soft-deleted
        include: [
          {
            model: db.JobApplication,
            include: [{ model: db.JobOpening }],
          },
        ],
      });

      if (!interview) {
        // Token may have been cleared after a previous response
        return errorResponse(res, "This link has already been used or has expired. If you need to change your response, please contact the HR team.", 404);
      }

      if (interview.candidateAcceptedAt || interview.candidateDeclinedAt) {
        const prevAction = interview.candidateAcceptedAt ? "accepted" : "declined";
        // Return 200 with their existing response so the page shows the right state
        return successResponse(res, { status: prevAction, alreadyResponded: true }, 
          prevAction === "accepted"
            ? "You have already accepted this interview. We look forward to meeting you!"
            : "You have already declined this interview."
        );
      }

      if (action === "accept") {
        await interview.update({
          candidateAcceptedAt: new Date(),
          status: "scheduled",
          // Keep token so candidate can view their response status — don't null it out
        });

        // Notify interviewers via WebSocket + DB notification
        try {
          const socketService = getSocketService();
          const candidateName = interview.JobApplication?.fullName || "Candidate";
          const jobTitle = interview.JobApplication?.JobOpening?.title || "Position";

          if (interview.interviewerUserId) {
            socketService.notifyUser(interview.interviewerUserId, "interview:accepted", {
              interviewId: interview.id,
              candidateName,
              jobTitle,
              message: `${candidateName} has accepted the interview for ${jobTitle}`,
            });
          }

          socketService.notifyBusiness(interview.businessId, "interview:accepted", {
            interviewId: interview.id,
            candidateName,
            jobTitle,
          });
        } catch { /* socket not ready */ }

        // DB notification to the scheduler
        InternalNotifier.send({
          businessId: interview.businessId,
          recipientUserId: interview.scheduledByUserId,
          moduleKey: "recruitment",
          type: "interview_accepted",
          title: "Interview Accepted",
          message: `${interview.JobApplication?.fullName || "Candidate"} has accepted the interview for ${interview.JobApplication?.JobOpening?.title || "the position"}.`,
          entityType: "interview",
          entityId: interview.id,
          priority: "high",
        }).catch(() => {});

        // Also notify the lead interviewer if different from scheduler
        if (interview.interviewerUserId && interview.interviewerUserId !== interview.scheduledByUserId) {
          InternalNotifier.send({
            businessId: interview.businessId,
            recipientUserId: interview.interviewerUserId,
            moduleKey: "recruitment",
            type: "interview_accepted",
            title: "Interview Accepted",
            message: `${interview.JobApplication?.fullName || "Candidate"} has accepted the interview.`,
            entityType: "interview",
            entityId: interview.id,
            priority: "high",
          }).catch(() => {});
        }

        successResponse(res, { status: "accepted" }, "Interview accepted successfully. We look forward to meeting you!");
      } else if (action === "decline") {
        await interview.update({
          candidateDeclinedAt: new Date(),
          status: "cancelled",
          // Keep token so candidate can view their response status — don't null it out
        });

        // Notify HR via WebSocket
        try {
          const socketService = getSocketService();
          const candidateName = interview.JobApplication?.fullName || "Candidate";
          socketService.notifyBusiness(interview.businessId, "interview:declined", {
            interviewId: interview.id,
            candidateName,
            message: `${candidateName} has declined the interview`,
          });
        } catch { /* socket not ready */ }

        // DB notification to scheduler
        InternalNotifier.send({
          businessId: interview.businessId,
          recipientUserId: interview.scheduledByUserId,
          moduleKey: "recruitment",
          type: "interview_declined",
          title: "Interview Declined",
          message: `${interview.JobApplication?.fullName || "Candidate"} has declined the interview for ${interview.JobApplication?.JobOpening?.title || "the position"}.`,
          entityType: "interview",
          entityId: interview.id,
          priority: "high",
        }).catch(() => {});

        // Also notify lead interviewer if different from scheduler
        if (interview.interviewerUserId && interview.interviewerUserId !== interview.scheduledByUserId) {
          InternalNotifier.send({
            businessId: interview.businessId,
            recipientUserId: interview.interviewerUserId,
            moduleKey: "recruitment",
            type: "interview_declined",
            title: "Interview Declined",
            message: `${interview.JobApplication?.fullName || "Candidate"} has declined the interview.`,
            entityType: "interview",
            entityId: interview.id,
            priority: "high",
          }).catch(() => {});
        }

        successResponse(res, { status: "declined" }, "Interview declined. We appreciate your response.");
      } else {
        return errorResponse(res, "Invalid action. Use 'accept' or 'decline'", 400);
      }
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  cancelInterview = async (req: Request, res: Response) => {
    try {
      const interview = await db.Interview.findOne({
        where: { id: req.params.id, businessId: req.user!.businessId },
      });
      if (!interview) return errorResponse(res, "Interview not found", 404);

      await interview.update({ status: "cancelled" });

      try {
        const socketService = getSocketService();
        socketService.notifyInterview(interview.id, "interview:cancelled", {
          interviewId: interview.id,
          message: "Interview has been cancelled",
        });
      } catch { /* socket not ready */ }

      successResponse(res, interview, "Interview cancelled.");
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  // Skills management
  listSkills = async (req: Request, res: Response) => {
    try {
      const { category } = req.query;
      const where: any = {
        [Op.or]: [
          { businessId: req.user!.businessId },
          { businessId: null }, // global skills
        ],
        status: "active",
      };
      if (category) where.category = category;

      const skills = await db.Skill.findAll({
        where,
        order: [["category", "ASC"], ["name", "ASC"]],
      });
      successResponse(res, skills);
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  createSkill = async (req: Request, res: Response) => {
    try {
      const { name, category } = req.body;
      if (!name) return errorResponse(res, "Skill name is required", 400);

      const existing = await db.Skill.findOne({
        where: { name, businessId: req.user!.businessId },
      });
      if (existing) return errorResponse(res, "Skill already exists", 409);

      const skill = await db.Skill.create({
        businessId: req.user!.businessId,
        name,
        category: category || null,
        status: "active",
      });
      successResponse(res, skill, "Skill created.", 201);
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  deleteSkill = async (req: Request, res: Response) => {
    try {
      const skill = await db.Skill.findOne({
        where: { id: req.params.id, businessId: req.user!.businessId },
      });
      if (!skill) return errorResponse(res, "Skill not found", 404);

      await skill.destroy();
      successResponse(res, null, "Skill deleted.");
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  // ── Per-interviewer notes ─────────────────────────────────────────────────

  getMyNotes = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // Verify the interview exists and this user is assigned to it
      // Include InterviewSkills so we can seed the note on first open
      const interview = await db.Interview.findOne({
        where: { id, businessId: req.user!.businessId },
        include: [
          {
            model: db.InterviewSkill,
            as: "skills",
            include: [{ model: db.Skill }],
          },
        ],
      });
      if (!interview) return errorResponse(res, "Interview not found", 404);

      const isAssigned =
        interview.interviewerUserId === userId ||
        (interview.panel || []).some((p: any) => p.userId === userId);
      const isHR = req.user!.roles?.includes("HR_MANAGER") || req.user!.roles?.includes("BUSINESS_ADMIN");

      if (!isAssigned && !isHR) return errorResponse(res, "Access denied", 403);

      // Seed skillRatings from the interview's assigned skills on first note creation.
      // After that the interviewer's own saved ratings are used (they can add/remove freely).
      const seededSkillRatings = (interview.skills || []).map((is: any) => ({
        skillId: is.skillId,
        skillName: is.Skill?.name || "",
        actualRating: null,
      }));

      // Get or create this interviewer's note record
      const [note] = await db.InterviewerNote.findOrCreate({
        where: { interviewId: id, interviewerId: userId },
        defaults: {
          businessId: req.user!.businessId,
          interviewId: id,
          interviewerId: userId,
          questions: [],
          notes: "",
          skillRatings: seededSkillRatings,
          candidateScore: null,
        },
      });

      successResponse(res, {
        note,
        interviewSkills: interview.skills || [],
      });
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };

  saveMyNotes = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { questions, notes, skillRatings, candidateScore } = req.body;

      const interview = await db.Interview.findOne({
        where: { id, businessId: req.user!.businessId },
      });
      if (!interview) return errorResponse(res, "Interview not found", 404);

      const isAssigned =
        interview.interviewerUserId === userId ||
        (interview.panel || []).some((p: any) => p.userId === userId);
      const isHR = req.user!.roles?.includes("HR_MANAGER") || req.user!.roles?.includes("BUSINESS_ADMIN");

      if (!isAssigned && !isHR) return errorResponse(res, "Access denied", 403);

      const [note, created] = await db.InterviewerNote.findOrCreate({
        where: { interviewId: id, interviewerId: userId },
        defaults: {
          businessId: req.user!.businessId,
          interviewId: id,
          interviewerId: userId,
          questions: questions || [],
          notes: notes || "",
          skillRatings: skillRatings || [],
          candidateScore: candidateScore ?? null,
        },
      });

      if (!created) {
        const updates: any = {};
        if (questions    !== undefined) updates.questions     = questions;
        if (notes        !== undefined) updates.notes         = notes;
        if (skillRatings !== undefined) updates.skillRatings  = skillRatings;
        if (candidateScore !== undefined) updates.candidateScore = candidateScore;
        await note.update(updates);
      }

      successResponse(res, note, "Notes saved.");
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

  // POST /recruitment/job-requests/:id/close — close an active job posting
  closeJob = async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const opening = await db.JobOpening.findOne({
        where: { id, businessId: req.user!.businessId },
      });
      if (!opening) return errorResponse(res, "Not found", 404);

      // Accept any status that means the job is live/active
      const closableStatuses = ["open", "approved", "active", "published"];
      if (!closableStatuses.includes(opening.status)) {
        return errorResponse(res, `Job cannot be closed (current status: ${opening.status})`, 400);
      }

      opening.status = "closed";
      await opening.save();

      await AuditLogService.log("CLOSED_JOB", "hr_job_openings", String(opening.id), null, {}, req);
      successResponse(res, opening, "Job closed and removed from careers page");
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

  deleteTemplate = async (req: Request, res: Response) => {
    try {
      const template = await db.RecruitmentTemplate.findOne({
        where: {
          id: req.params.id,
          businessId: req.user!.businessId,
        },
      });

      if (!template) {
        return errorResponse(res, "Recruitment template not found.", 404);
      }

      await template.destroy();
      await AuditLogService.log(
        "DELETED_RECRUITMENT_TEMPLATE",
        "hr_recruitment_templates",
        String(template.id),
        template.toJSON(),
        {},
        req,
      );
      successResponse(res, null, "Recruitment template deleted.");
    } catch (e: any) {
      errorResponse(res, e.message);
    }
  };
}
