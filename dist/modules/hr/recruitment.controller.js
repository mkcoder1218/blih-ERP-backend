"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecruitmentController = void 0;
const recruitment_service_1 = require("./recruitment.service");
const response_1 = require("../../utils/response");
const auditLog_service_1 = require("../../services/auditLog.service");
const models_1 = require("../../models");
const sequelize_1 = require("sequelize");
const file_service_1 = require("../file/file.service");
const crypto_1 = __importDefault(require("crypto"));
const interviewMailer_1 = require("../../utils/interviewMailer");
const socket_1 = require("../../services/realtime/socket");
const notification_service_1 = require("../notification/notification.service");
class RecruitmentController {
    constructor() {
        this.service = new recruitment_service_1.RecruitmentService();
        this.fileService = new file_service_1.FileService();
        this.seedForms = async (req, res) => {
            await this.service.provisionForms(req.user.businessId);
            (0, response_1.successResponse)(res, null, "Recruitment templates seeded.");
        };
        // Public Apply
        this.publicApply = async (req, res) => {
            try {
                const app = await this.service.publicApply(req.params.jobOpeningId, req.body);
                (0, response_1.successResponse)(res, { jobApplicationId: app.id }, "Application received.", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        // Public List Jobs — filtered by business slug
        this.publicListJobs = async (req, res) => {
            try {
                const { businessSlug } = req.params;
                // Find business by slug, include branding
                const business = await models_1.db.Business.findOne({
                    where: { slug: businessSlug },
                    attributes: ['id', 'name', 'slug', 'email'],
                    include: [
                        {
                            model: models_1.db.BusinessBranding,
                            as: 'BusinessBranding',
                            attributes: ['companyName', 'tagline', 'logoFileId', 'primaryColor', 'accentColor'],
                            required: false,
                        },
                    ],
                });
                if (!business) {
                    return (0, response_1.errorResponse)(res, 'Business not found', 404);
                }
                const jobs = await models_1.db.JobOpening.findAll({
                    where: { businessId: business.id, status: "open" },
                    order: [["createdAt", "DESC"]],
                });
                const mapped = jobs.map((o) => this.mapJobRequest(o));
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
                (0, response_1.successResponse)(res, { business: businessData, jobs: mapped });
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        // Public Get Job
        this.publicGetJob = async (req, res) => {
            try {
                const { businessSlug, id } = req.params;
                // Find business by slug
                const business = await models_1.db.Business.findOne({
                    where: { slug: businessSlug },
                    attributes: ['id'],
                });
                if (!business) {
                    return (0, response_1.errorResponse)(res, 'Business not found', 404);
                }
                const job = await models_1.db.JobOpening.findOne({
                    where: {
                        id,
                        businessId: business.id,
                        status: "open"
                    },
                });
                if (!job)
                    return (0, response_1.errorResponse)(res, "Job not found", 404);
                (0, response_1.successResponse)(res, this.mapJobRequest(job));
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.publicUploadResume = async (req, res) => {
            try {
                if (!req.file)
                    return (0, response_1.errorResponse)(res, "No file uploaded", 400);
                const job = await models_1.db.JobOpening.findByPk(req.params.jobOpeningId);
                if (!job)
                    return (0, response_1.errorResponse)(res, "Job not found", 404);
                // Public upload — no authenticated user. uploadedByUserId is NULL.
                // The file is linked to the application via JobApplication.cvFileId after submission.
                const asset = await this.fileService.saveAssetRecord(job.businessId, null, req.file, { source: "public_resume", jobOpeningId: job.id });
                const downloadUrl = `${req.protocol}://${req.get("host")}/api/files/${asset.id}/download`;
                (0, response_1.successResponse)(res, {
                    fileId: asset.id,
                    downloadUrl,
                    originalName: asset.originalName,
                }, "Resume uploaded successfully.", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listOpenings = async (req, res) => {
            try {
                const limit = Number(req.query.limit || 20);
                const offset = Number(req.query.offset || 0);
                const q = { businessId: req.user.businessId };
                const result = await models_1.db.JobOpening.findAndCountAll({
                    where: q,
                    limit,
                    offset,
                });
                (0, response_1.paginationResponse)(res, result.rows, result.count, offset / limit + 1, limit);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listApplications = async (req, res) => {
            try {
                const applications = await models_1.db.JobApplication.findAll({
                    where: { businessId: req.user.businessId },
                    order: [["createdAt", "DESC"]],
                });
                // Enrich each application with average skill rating from all interviewers' notes
                const appIds = applications.map((a) => a.id);
                // Get all interviews for these applications, then get their notes
                const interviews = appIds.length > 0
                    ? await models_1.db.Interview.findAll({
                        where: { jobApplicationId: appIds, businessId: req.user.businessId },
                        attributes: ["id", "jobApplicationId"],
                    })
                    : [];
                const interviewIds = interviews.map((iv) => iv.id);
                const interviewAppMap = {};
                interviews.forEach((iv) => { interviewAppMap[iv.id] = iv.jobApplicationId; });
                const notes = interviewIds.length > 0
                    ? await models_1.db.InterviewerNote.findAll({
                        where: { interviewId: interviewIds },
                        attributes: ["interviewId", "skillRatings", "candidateScore"],
                    })
                    : [];
                // Build map: jobApplicationId → average rating across all notes
                // Priority: per-skill actualRatings (1-5 scale); fallback to candidateScore (0-100 → 1-5)
                const ratingMap = {};
                for (const note of notes) {
                    const appId = interviewAppMap[note.interviewId];
                    if (!appId)
                        continue;
                    // Try skill ratings first
                    const skillRatings = (note.skillRatings || [])
                        .map((r) => r.actualRating)
                        .filter((r) => r != null && typeof r === "number");
                    let ratingValue = null;
                    if (skillRatings.length > 0) {
                        // Average of per-skill ratings (already on 1-5 scale)
                        ratingValue = skillRatings.reduce((s, r) => s + r, 0) / skillRatings.length;
                    }
                    else if (note.candidateScore != null && typeof note.candidateScore === "number") {
                        // Convert candidateScore (0-100) to 1-5 scale
                        ratingValue = (note.candidateScore / 100) * 5;
                    }
                    if (ratingValue == null)
                        continue;
                    if (!ratingMap[appId])
                        ratingMap[appId] = { sum: 0, count: 0 };
                    ratingMap[appId].sum += ratingValue;
                    ratingMap[appId].count += 1;
                }
                const enriched = applications.map((a) => {
                    const entry = ratingMap[a.id];
                    const avgSkillRating = entry
                        ? Math.round((entry.sum / entry.count) * 10) / 10
                        : null;
                    return { ...a.toJSON(), avgSkillRating };
                });
                (0, response_1.successResponse)(res, enriched);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.createOpening = async (req, res) => {
            try {
                const incoming = { ...(req.body || {}) };
                const metadata = { ...(incoming.metadata || {}) };
                if (!metadata.approvalStatus)
                    metadata.approvalStatus = "pending";
                incoming.metadata = metadata;
                const opening = await models_1.db.JobOpening.create({
                    ...incoming,
                    businessId: req.user.businessId,
                    requestedByUserId: req.user.id,
                });
                await auditLog_service_1.AuditLogService.log("CREATED_JOB_OPENING", "hr_job_openings", String(opening.id), null, {}, req);
                (0, response_1.successResponse)(res, opening, "Job opening defined.", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.incrementJobView = async (req, res) => {
            try {
                const { businessSlug, id } = req.params;
                // Find business by slug
                const business = await models_1.db.Business.findOne({
                    where: { slug: businessSlug },
                    attributes: ['id'],
                });
                if (!business) {
                    return (0, response_1.errorResponse)(res, 'Business not found', 404);
                }
                const job = await models_1.db.JobOpening.findOne({
                    where: {
                        id,
                        businessId: business.id
                    },
                });
                if (!job)
                    return (0, response_1.errorResponse)(res, "Job not found", 404);
                await job.increment("views", { by: 1 });
                (0, response_1.successResponse)(res, null, "View counted.");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.scheduleInterview = async (req, res) => {
            try {
                const { jobApplicationId, interviewAt, duration, totalSessions, type, venue, department, panel, questions, additionalNotes, interviewerUserId, skills, // [{ skillId, requiredRating }]
                 } = req.body;
                // Validate application exists and belongs to this business
                const application = await models_1.db.JobApplication.findOne({
                    where: { id: jobApplicationId, businessId: req.user.businessId },
                    include: [{ model: models_1.db.JobOpening }],
                });
                if (!application)
                    return (0, response_1.errorResponse)(res, "Application not found", 404);
                // Generate acceptance token
                const acceptanceToken = crypto_1.default.randomBytes(32).toString("hex");
                const interview = await models_1.db.Interview.create({
                    businessId: req.user.businessId,
                    jobApplicationId,
                    scheduledByUserId: req.user.id,
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
                    const skillRecords = skills.map((s) => ({
                        businessId: req.user.businessId,
                        interviewId: interview.id,
                        skillId: s.skillId,
                        requiredRating: s.requiredRating,
                    }));
                    await models_1.db.InterviewSkill.bulkCreate(skillRecords);
                }
                // Advance application stage
                await models_1.db.JobApplication.update({ stage: "interview" }, { where: { id: jobApplicationId, businessId: req.user.businessId } });
                // Build acceptance/decline URLs
                const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
                const acceptUrl = `${baseUrl}/interview/respond?token=${acceptanceToken}&action=accept`;
                const declineUrl = `${baseUrl}/interview/respond?token=${acceptanceToken}&action=decline`;
                // Send email to candidate
                const candidateEmail = application.email;
                const candidateName = application.fullName || "Candidate";
                const jobTitle = application.JobOpening?.title || "the position";
                if (candidateEmail) {
                    (0, interviewMailer_1.sendInterviewInviteEmail)({
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
                        const socketService = (0, socket_1.getSocketService)();
                        socketService.notifyUser(interviewerUserId, "interview:assigned", {
                            interviewId: interview.id,
                            candidateName,
                            jobTitle,
                            interviewAt,
                            message: `You have been assigned to interview ${candidateName} for ${jobTitle}`,
                        });
                    }
                    catch {
                        // Socket not initialized yet — skip silently
                    }
                    // DB notification (shows in bell)
                    notification_service_1.InternalNotifier.send({
                        businessId: req.user.businessId,
                        recipientUserId: interviewerUserId,
                        senderUserId: req.user.id,
                        moduleKey: "recruitment",
                        type: "interview_assigned",
                        title: "Interview Assignment",
                        message: `You have been assigned to interview ${candidateName} for ${jobTitle} on ${new Date(interviewAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`,
                        entityType: "interview",
                        entityId: interview.id,
                        priority: "high",
                    }).catch((err) => console.error("[Notifier] Failed to save interviewer notification:", err));
                    // Email
                    const interviewer = await models_1.db.User.findByPk(interviewerUserId);
                    if (interviewer?.email) {
                        (0, interviewMailer_1.sendInterviewerNotificationEmail)({
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
                        .filter((p) => p.userId)
                        .map((p) => p.userId);
                    if (panelUserIds.length > 0) {
                        // WebSocket
                        try {
                            const socketService = (0, socket_1.getSocketService)();
                            socketService.notifyUsers(panelUserIds, "interview:assigned", {
                                interviewId: interview.id,
                                candidateName,
                                jobTitle,
                                interviewAt,
                                message: `You have been added to the interview panel for ${candidateName}`,
                            });
                        }
                        catch {
                            // Socket not initialized yet — skip silently
                        }
                        // DB notifications for each panel member
                        const panelNotifications = panelUserIds
                            .filter((uid) => uid !== interviewerUserId) // avoid duplicate if lead is also in panel array
                            .map((uid) => notification_service_1.InternalNotifier.send({
                            businessId: req.user.businessId,
                            recipientUserId: uid,
                            senderUserId: req.user.id,
                            moduleKey: "recruitment",
                            type: "interview_panel_assigned",
                            title: "Added to Interview Panel",
                            message: `You have been added to the interview panel for ${candidateName} (${jobTitle}).`,
                            entityType: "interview",
                            entityId: interview.id,
                            priority: "normal",
                        }).catch((err) => console.error("[Notifier] Failed to save panel notification:", err)));
                        await Promise.allSettled(panelNotifications);
                    }
                }
                await auditLog_service_1.AuditLogService.log("SCHEDULED_INTERVIEW", "hr_interviews", String(interview.id), null, { jobApplicationId }, req);
                // Return interview with skills
                const fullInterview = await models_1.db.Interview.findByPk(interview.id, {
                    include: [
                        {
                            model: models_1.db.InterviewSkill,
                            as: "skills",
                            include: [{ model: models_1.db.Skill }],
                        },
                    ],
                });
                (0, response_1.successResponse)(res, fullInterview, "Interview scheduled. Candidate invitation sent.", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listInterviews = async (req, res) => {
            try {
                const user = req.user;
                const isHR = user.roles?.includes("HR_MANAGER") || user.roles?.includes("BUSINESS_ADMIN");
                // Regular employees only see interviews they're assigned to
                const where = { businessId: user.businessId };
                if (!isHR) {
                    where[sequelize_1.Op.or] = [
                        { interviewerUserId: user.id },
                        models_1.db.sequelize.literal(`EXISTS (SELECT 1 FROM jsonb_array_elements("Interview"."panel") AS p WHERE (p->>'userId') = '${user.id}')`),
                    ];
                }
                const interviews = await models_1.db.Interview.findAll({
                    where,
                    order: [["interviewAt", "ASC"]],
                    include: [
                        {
                            model: models_1.db.InterviewSkill,
                            as: "skills",
                            include: [{ model: models_1.db.Skill }],
                        },
                        {
                            model: models_1.db.JobApplication,
                            include: [{ model: models_1.db.JobOpening }],
                        },
                    ],
                });
                (0, response_1.successResponse)(res, interviews);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.getInterview = async (req, res) => {
            try {
                const user = req.user;
                const isHR = user.roles?.includes("HR_MANAGER") || user.roles?.includes("BUSINESS_ADMIN");
                const interview = await models_1.db.Interview.findOne({
                    where: { id: req.params.id, businessId: user.businessId },
                    include: [
                        {
                            model: models_1.db.InterviewSkill,
                            as: "skills",
                            include: [{ model: models_1.db.Skill }],
                        },
                        {
                            model: models_1.db.JobApplication,
                            include: [{ model: models_1.db.JobOpening }],
                        },
                    ],
                });
                if (!interview)
                    return (0, response_1.errorResponse)(res, "Interview not found", 404);
                // Non-HR users can only view interviews they're assigned to
                if (!isHR) {
                    const panel = interview.panel || [];
                    const isAssigned = interview.interviewerUserId === user.id ||
                        panel.some((p) => p.userId === user.id);
                    if (!isAssigned)
                        return (0, response_1.errorResponse)(res, "Access denied", 403);
                }
                (0, response_1.successResponse)(res, interview);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.updateInterview = async (req, res) => {
            try {
                const user = req.user;
                const isHR = user.roles?.includes("HR_MANAGER") || user.roles?.includes("BUSINESS_ADMIN");
                const interview = await models_1.db.Interview.findOne({
                    where: { id: req.params.id, businessId: user.businessId },
                });
                if (!interview)
                    return (0, response_1.errorResponse)(res, "Interview not found", 404);
                // Non-HR can only update questions/skills if they're the assigned interviewer
                if (!isHR) {
                    const panel = interview.panel || [];
                    const isAssigned = interview.interviewerUserId === user.id ||
                        panel.some((p) => p.userId === user.id);
                    if (!isAssigned)
                        return (0, response_1.errorResponse)(res, "Access denied", 403);
                }
                const { questions, skills, additionalNotes, feedback, score } = req.body;
                // HR can update everything; interviewers can update questions, skills, feedback, score
                const updates = {};
                if (questions !== undefined)
                    updates.questions = questions;
                if (additionalNotes !== undefined)
                    updates.additionalNotes = additionalNotes;
                if (feedback !== undefined)
                    updates.feedback = feedback;
                if (score !== undefined)
                    updates.score = score;
                if (isHR) {
                    const { interviewAt, duration, type, venue, department, panel: newPanel, totalSessions, interviewerUserId } = req.body;
                    if (interviewAt !== undefined)
                        updates.interviewAt = interviewAt;
                    if (duration !== undefined)
                        updates.duration = duration;
                    if (type !== undefined)
                        updates.type = type;
                    if (venue !== undefined)
                        updates.venue = venue;
                    if (department !== undefined)
                        updates.department = department;
                    if (newPanel !== undefined)
                        updates.panel = newPanel;
                    if (totalSessions !== undefined)
                        updates.totalSessions = totalSessions;
                    if (interviewerUserId !== undefined)
                        updates.interviewerUserId = interviewerUserId;
                }
                await interview.update(updates);
                // Update skills if provided
                if (skills !== undefined && Array.isArray(skills)) {
                    // Remove existing skills and re-insert
                    await models_1.db.InterviewSkill.destroy({ where: { interviewId: interview.id } });
                    if (skills.length > 0) {
                        await models_1.db.InterviewSkill.bulkCreate(skills.map((s) => ({
                            businessId: user.businessId,
                            interviewId: interview.id,
                            skillId: s.skillId,
                            requiredRating: s.requiredRating,
                            actualRating: s.actualRating ?? null,
                        })));
                    }
                }
                // Notify via WebSocket
                try {
                    const socketService = (0, socket_1.getSocketService)();
                    socketService.notifyInterview(interview.id, "interview:updated", {
                        interviewId: interview.id,
                        updatedBy: user.fullName,
                    });
                }
                catch { /* socket not ready */ }
                const updated = await models_1.db.Interview.findByPk(interview.id, {
                    include: [
                        {
                            model: models_1.db.InterviewSkill,
                            as: "skills",
                            include: [{ model: models_1.db.Skill }],
                        },
                    ],
                });
                (0, response_1.successResponse)(res, updated, "Interview updated.");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.completeSession = async (req, res) => {
            try {
                const user = req.user;
                const interview = await models_1.db.Interview.findOne({
                    where: { id: req.params.id, businessId: user.businessId },
                    include: [
                        {
                            model: models_1.db.JobApplication,
                            include: [{ model: models_1.db.JobOpening }],
                        },
                    ],
                });
                if (!interview)
                    return (0, response_1.errorResponse)(res, "Interview not found", 404);
                if (interview.status === "cancelled") {
                    return (0, response_1.errorResponse)(res, "Cannot complete a cancelled interview", 400);
                }
                // Only the interview leader (interviewerUserId) or the person who scheduled it
                // can advance sessions. Panel members can submit their own notes but cannot
                // move the interview forward.
                const isLeader = interview.interviewerUserId === user.id ||
                    interview.scheduledByUserId === user.id;
                const isHR = user.roles?.includes("HR_MANAGER") ||
                    user.roles?.includes("BUSINESS_ADMIN") ||
                    (user.permissions || []).includes("interview.schedule");
                if (!isLeader && !isHR) {
                    return (0, response_1.errorResponse)(res, "Only the interview leader can complete a session", 403);
                }
                const { feedback, score, skillRatings } = req.body;
                // Update skill actual ratings if provided
                if (skillRatings && Array.isArray(skillRatings)) {
                    for (const sr of skillRatings) {
                        await models_1.db.InterviewSkill.update({ actualRating: sr.actualRating }, { where: { interviewId: interview.id, skillId: sr.skillId } });
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
                    await models_1.db.JobApplication.update({ stage: "offer" }, { where: { id: interview.jobApplicationId, businessId: user.businessId } });
                    // Notify HR via WebSocket
                    try {
                        const socketService = (0, socket_1.getSocketService)();
                        socketService.notifyBusiness(user.businessId, "interview:completed", {
                            interviewId: interview.id,
                            candidateName: interview.JobApplication?.fullName || "Candidate",
                            jobTitle: interview.JobApplication?.JobOpening?.title || "Position",
                            message: "All interview sessions completed. Candidate advanced to offer stage.",
                        });
                    }
                    catch { /* socket not ready */ }
                    // DB notification to scheduler
                    notification_service_1.InternalNotifier.send({
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
                    }).catch(() => { });
                    (0, response_1.successResponse)(res, interview, "All sessions completed. Candidate advanced to offer stage.");
                }
                else {
                    // More sessions remaining
                    await interview.update({
                        currentSession: nextSession,
                        feedback: feedback || interview.feedback,
                        score: score ?? interview.score,
                    });
                    try {
                        const socketService = (0, socket_1.getSocketService)();
                        socketService.notifyInterview(interview.id, "interview:session_completed", {
                            interviewId: interview.id,
                            currentSession: nextSession - 1,
                            totalSessions: interview.totalSessions,
                            nextSession,
                        });
                    }
                    catch { /* socket not ready */ }
                    (0, response_1.successResponse)(res, interview, `Session ${nextSession - 1} completed. ${interview.totalSessions - nextSession + 1} session(s) remaining.`);
                }
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.respondToInterview = async (req, res) => {
            try {
                const { token, action } = req.query;
                if (!token || !action) {
                    return (0, response_1.errorResponse)(res, "Token and action are required", 400);
                }
                const interview = await models_1.db.Interview.findOne({
                    where: { acceptanceToken: token },
                    paranoid: false, // find even if soft-deleted
                    include: [
                        {
                            model: models_1.db.JobApplication,
                            include: [{ model: models_1.db.JobOpening }],
                        },
                    ],
                });
                if (!interview) {
                    // Token may have been cleared after a previous response
                    return (0, response_1.errorResponse)(res, "This link has already been used or has expired. If you need to change your response, please contact the HR team.", 404);
                }
                if (interview.candidateAcceptedAt || interview.candidateDeclinedAt) {
                    const prevAction = interview.candidateAcceptedAt ? "accepted" : "declined";
                    // Return 200 with their existing response so the page shows the right state
                    return (0, response_1.successResponse)(res, { status: prevAction, alreadyResponded: true }, prevAction === "accepted"
                        ? "You have already accepted this interview. We look forward to meeting you!"
                        : "You have already declined this interview.");
                }
                if (action === "accept") {
                    await interview.update({
                        candidateAcceptedAt: new Date(),
                        status: "scheduled",
                        // Keep token so candidate can view their response status — don't null it out
                    });
                    // Notify interviewers via WebSocket + DB notification
                    try {
                        const socketService = (0, socket_1.getSocketService)();
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
                    }
                    catch { /* socket not ready */ }
                    // DB notification to the scheduler
                    notification_service_1.InternalNotifier.send({
                        businessId: interview.businessId,
                        recipientUserId: interview.scheduledByUserId,
                        moduleKey: "recruitment",
                        type: "interview_accepted",
                        title: "Interview Accepted",
                        message: `${interview.JobApplication?.fullName || "Candidate"} has accepted the interview for ${interview.JobApplication?.JobOpening?.title || "the position"}.`,
                        entityType: "interview",
                        entityId: interview.id,
                        priority: "high",
                    }).catch(() => { });
                    // Also notify the lead interviewer if different from scheduler
                    if (interview.interviewerUserId && interview.interviewerUserId !== interview.scheduledByUserId) {
                        notification_service_1.InternalNotifier.send({
                            businessId: interview.businessId,
                            recipientUserId: interview.interviewerUserId,
                            moduleKey: "recruitment",
                            type: "interview_accepted",
                            title: "Interview Accepted",
                            message: `${interview.JobApplication?.fullName || "Candidate"} has accepted the interview.`,
                            entityType: "interview",
                            entityId: interview.id,
                            priority: "high",
                        }).catch(() => { });
                    }
                    (0, response_1.successResponse)(res, { status: "accepted" }, "Interview accepted successfully. We look forward to meeting you!");
                }
                else if (action === "decline") {
                    await interview.update({
                        candidateDeclinedAt: new Date(),
                        status: "cancelled",
                        // Keep token so candidate can view their response status — don't null it out
                    });
                    // Notify HR via WebSocket
                    try {
                        const socketService = (0, socket_1.getSocketService)();
                        const candidateName = interview.JobApplication?.fullName || "Candidate";
                        socketService.notifyBusiness(interview.businessId, "interview:declined", {
                            interviewId: interview.id,
                            candidateName,
                            message: `${candidateName} has declined the interview`,
                        });
                    }
                    catch { /* socket not ready */ }
                    // DB notification to scheduler
                    notification_service_1.InternalNotifier.send({
                        businessId: interview.businessId,
                        recipientUserId: interview.scheduledByUserId,
                        moduleKey: "recruitment",
                        type: "interview_declined",
                        title: "Interview Declined",
                        message: `${interview.JobApplication?.fullName || "Candidate"} has declined the interview for ${interview.JobApplication?.JobOpening?.title || "the position"}.`,
                        entityType: "interview",
                        entityId: interview.id,
                        priority: "high",
                    }).catch(() => { });
                    // Also notify lead interviewer if different from scheduler
                    if (interview.interviewerUserId && interview.interviewerUserId !== interview.scheduledByUserId) {
                        notification_service_1.InternalNotifier.send({
                            businessId: interview.businessId,
                            recipientUserId: interview.interviewerUserId,
                            moduleKey: "recruitment",
                            type: "interview_declined",
                            title: "Interview Declined",
                            message: `${interview.JobApplication?.fullName || "Candidate"} has declined the interview.`,
                            entityType: "interview",
                            entityId: interview.id,
                            priority: "high",
                        }).catch(() => { });
                    }
                    (0, response_1.successResponse)(res, { status: "declined" }, "Interview declined. We appreciate your response.");
                }
                else {
                    return (0, response_1.errorResponse)(res, "Invalid action. Use 'accept' or 'decline'", 400);
                }
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.cancelInterview = async (req, res) => {
            try {
                const interview = await models_1.db.Interview.findOne({
                    where: { id: req.params.id, businessId: req.user.businessId },
                });
                if (!interview)
                    return (0, response_1.errorResponse)(res, "Interview not found", 404);
                await interview.update({ status: "cancelled" });
                try {
                    const socketService = (0, socket_1.getSocketService)();
                    socketService.notifyInterview(interview.id, "interview:cancelled", {
                        interviewId: interview.id,
                        message: "Interview has been cancelled",
                    });
                }
                catch { /* socket not ready */ }
                (0, response_1.successResponse)(res, interview, "Interview cancelled.");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        // Skills management
        this.listSkills = async (req, res) => {
            try {
                const { category } = req.query;
                const where = {
                    [sequelize_1.Op.or]: [
                        { businessId: req.user.businessId },
                        { businessId: null }, // global skills
                    ],
                    status: "active",
                };
                if (category)
                    where.category = category;
                const skills = await models_1.db.Skill.findAll({
                    where,
                    order: [["category", "ASC"], ["name", "ASC"]],
                });
                (0, response_1.successResponse)(res, skills);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.createSkill = async (req, res) => {
            try {
                const { name, category } = req.body;
                if (!name)
                    return (0, response_1.errorResponse)(res, "Skill name is required", 400);
                const existing = await models_1.db.Skill.findOne({
                    where: { name, businessId: req.user.businessId },
                });
                if (existing)
                    return (0, response_1.errorResponse)(res, "Skill already exists", 409);
                const skill = await models_1.db.Skill.create({
                    businessId: req.user.businessId,
                    name,
                    category: category || null,
                    status: "active",
                });
                (0, response_1.successResponse)(res, skill, "Skill created.", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.deleteSkill = async (req, res) => {
            try {
                const skill = await models_1.db.Skill.findOne({
                    where: { id: req.params.id, businessId: req.user.businessId },
                });
                if (!skill)
                    return (0, response_1.errorResponse)(res, "Skill not found", 404);
                await skill.destroy();
                (0, response_1.successResponse)(res, null, "Skill deleted.");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        // ── Per-interviewer notes ─────────────────────────────────────────────────
        this.getMyNotes = async (req, res) => {
            try {
                const { id } = req.params;
                const userId = req.user.id;
                // Verify the interview exists and this user is assigned to it
                // Include InterviewSkills so we can seed the note on first open
                const interview = await models_1.db.Interview.findOne({
                    where: { id, businessId: req.user.businessId },
                    include: [
                        {
                            model: models_1.db.InterviewSkill,
                            as: "skills",
                            include: [{ model: models_1.db.Skill }],
                        },
                    ],
                });
                if (!interview)
                    return (0, response_1.errorResponse)(res, "Interview not found", 404);
                const isAssigned = interview.interviewerUserId === userId ||
                    (interview.panel || []).some((p) => p.userId === userId);
                const isHR = req.user.roles?.includes("HR_MANAGER") || req.user.roles?.includes("BUSINESS_ADMIN");
                if (!isAssigned && !isHR)
                    return (0, response_1.errorResponse)(res, "Access denied", 403);
                // Seed skillRatings from the interview's assigned skills on first note creation.
                // After that the interviewer's own saved ratings are used (they can add/remove freely).
                const seededSkillRatings = (interview.skills || []).map((is) => ({
                    skillId: is.skillId,
                    skillName: is.Skill?.name || "",
                    actualRating: null,
                }));
                // Get or create this interviewer's note record
                const [note] = await models_1.db.InterviewerNote.findOrCreate({
                    where: { interviewId: id, interviewerId: userId },
                    defaults: {
                        businessId: req.user.businessId,
                        interviewId: id,
                        interviewerId: userId,
                        questions: [],
                        notes: "",
                        skillRatings: seededSkillRatings,
                        candidateScore: null,
                    },
                });
                (0, response_1.successResponse)(res, {
                    note,
                    interviewSkills: interview.skills || [],
                });
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.saveMyNotes = async (req, res) => {
            try {
                const { id } = req.params;
                const userId = req.user.id;
                const { questions, notes, skillRatings, candidateScore } = req.body;
                const interview = await models_1.db.Interview.findOne({
                    where: { id, businessId: req.user.businessId },
                });
                if (!interview)
                    return (0, response_1.errorResponse)(res, "Interview not found", 404);
                const isAssigned = interview.interviewerUserId === userId ||
                    (interview.panel || []).some((p) => p.userId === userId);
                const isHR = req.user.roles?.includes("HR_MANAGER") || req.user.roles?.includes("BUSINESS_ADMIN");
                if (!isAssigned && !isHR)
                    return (0, response_1.errorResponse)(res, "Access denied", 403);
                const [note, created] = await models_1.db.InterviewerNote.findOrCreate({
                    where: { interviewId: id, interviewerId: userId },
                    defaults: {
                        businessId: req.user.businessId,
                        interviewId: id,
                        interviewerId: userId,
                        questions: questions || [],
                        notes: notes || "",
                        skillRatings: skillRatings || [],
                        candidateScore: candidateScore ?? null,
                    },
                });
                if (!created) {
                    const updates = {};
                    if (questions !== undefined)
                        updates.questions = questions;
                    if (notes !== undefined)
                        updates.notes = notes;
                    if (skillRatings !== undefined)
                        updates.skillRatings = skillRatings;
                    if (candidateScore !== undefined)
                        updates.candidateScore = candidateScore;
                    await note.update(updates);
                }
                (0, response_1.successResponse)(res, note, "Notes saved.");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listJobRequests = async (req, res) => {
            try {
                const limit = Number(req.query.limit || 50);
                const page = Number(req.query.page || 1);
                const offset = (page - 1) * limit;
                const status = String(req.query.status || "").toLowerCase(); // pending|approved|declined
                const onlyApprovedByMe = String(req.query.approvedByMe || "").toLowerCase() === "true";
                const onlyApprovedByOthers = String(req.query.approvedByOthers || "").toLowerCase() === "true";
                const includePublished = String(req.query.includePublished || "").toLowerCase() === "true";
                const where = {
                    businessId: req.user.businessId,
                };
                if (!includePublished) {
                    where.status = { [sequelize_1.Op.ne]: "open" };
                }
                const andFilters = [];
                if (status) {
                    andFilters.push(models_1.db.sequelize.where(models_1.db.sequelize.json("metadata.approvalStatus"), status));
                }
                if (onlyApprovedByMe) {
                    andFilters.push(models_1.db.sequelize.literal(`EXISTS (SELECT 1 FROM jsonb_array_elements(metadata->'approvals') AS elem WHERE (elem->>'userId')::uuid = '${req.user.id}'::uuid)`));
                }
                else if (onlyApprovedByOthers) {
                    andFilters.push(models_1.db.sequelize.literal(`jsonb_array_length(metadata->'approvals') > 0`));
                    andFilters.push(models_1.db.sequelize.literal(`NOT EXISTS (SELECT 1 FROM jsonb_array_elements(metadata->'approvals') AS elem WHERE (elem->>'userId')::uuid = '${req.user.id}'::uuid)`));
                }
                if (andFilters.length > 0) {
                    where[sequelize_1.Op.and] = andFilters;
                }
                const result = await models_1.db.JobOpening.findAndCountAll({
                    where,
                    limit,
                    offset,
                    order: [["createdAt", "DESC"]],
                });
                const rows = (result.rows || []).map((o) => this.mapJobRequest(o));
                (0, response_1.paginationResponse)(res, rows, result.count, page, limit);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.approveJobRequest = async (req, res) => {
            try {
                const id = req.params.id;
                const opening = await models_1.db.JobOpening.findOne({
                    where: { id, businessId: req.user.businessId },
                });
                if (!opening)
                    return (0, response_1.errorResponse)(res, "Not found", 404);
                const metadata = JSON.parse(JSON.stringify(opening.metadata || {}));
                if (!metadata.approvals)
                    metadata.approvals = [];
                const userRoles = req.user.roles || [];
                let roleKey = "";
                if (userRoles.includes("HR_MANAGER"))
                    roleKey = "HR_MANAGER";
                else if (userRoles.includes("BUSINESS_ADMIN"))
                    roleKey = "BUSINESS_ADMIN";
                else if (userRoles.includes("FINANCE_MANAGER"))
                    roleKey = "FINANCE_MANAGER";
                if (!roleKey)
                    return (0, response_1.errorResponse)(res, "User does not have an approving role", 403);
                const already = (metadata.approvals || []).find((a) => a.role === roleKey);
                if (already)
                    return (0, response_1.errorResponse)(res, `Already approved as ${roleKey}`);
                metadata.approvals.push({
                    role: roleKey,
                    userId: req.user.id,
                    approvedAt: new Date().toISOString(),
                });
                const rolesInApprovals = metadata.approvals.map((a) => a.role);
                const isFullyApproved = [
                    "HR_MANAGER",
                    "BUSINESS_ADMIN",
                    "FINANCE_MANAGER",
                ].every((r) => rolesInApprovals.includes(r));
                if (isFullyApproved) {
                    metadata.approvalStatus = "approved";
                    opening.status = "approved";
                }
                else {
                    metadata.approvalStatus = "pending";
                }
                opening.metadata = metadata;
                opening.changed("metadata", true);
                await opening.save();
                await auditLog_service_1.AuditLogService.log("APPROVED_JOB_REQUEST", "hr_job_openings", String(opening.id), null, { role: roleKey, approvedByUserId: req.user.id }, req);
                (0, response_1.successResponse)(res, opening, isFullyApproved ? "Fully Approved" : `Approved as ${roleKey}`);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.publishJob = async (req, res) => {
            try {
                const id = req.params.id;
                const opening = await models_1.db.JobOpening.findOne({
                    where: { id, businessId: req.user.businessId },
                });
                if (!opening)
                    return (0, response_1.errorResponse)(res, "Not found", 404);
                const m = opening.metadata || {};
                const isApproved = m.approvalStatus === "approved";
                // Check both column status and metadata status for backwards compatibility
                if (opening.status !== "approved" && !isApproved) {
                    return (0, response_1.errorResponse)(res, "Job must be fully approved before posting", 400);
                }
                opening.status = "open";
                await opening.save();
                await auditLog_service_1.AuditLogService.log("PUBLISHED_JOB", "hr_job_openings", String(opening.id), null, {}, req);
                (0, response_1.successResponse)(res, opening, "Job published successfully");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        // POST /recruitment/job-requests/:id/close — close an active job posting
        this.closeJob = async (req, res) => {
            try {
                const id = req.params.id;
                const opening = await models_1.db.JobOpening.findOne({
                    where: { id, businessId: req.user.businessId },
                });
                if (!opening)
                    return (0, response_1.errorResponse)(res, "Not found", 404);
                // Accept any status that means the job is live/active
                const closableStatuses = ["open", "approved", "active", "published"];
                if (!closableStatuses.includes(opening.status)) {
                    return (0, response_1.errorResponse)(res, `Job cannot be closed (current status: ${opening.status})`, 400);
                }
                opening.status = "closed";
                await opening.save();
                await auditLog_service_1.AuditLogService.log("CLOSED_JOB", "hr_job_openings", String(opening.id), null, {}, req);
                (0, response_1.successResponse)(res, opening, "Job closed and removed from careers page");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.declineJobRequest = async (req, res) => {
            try {
                const id = req.params.id;
                const opening = await models_1.db.JobOpening.findOne({
                    where: { id, businessId: req.user.businessId },
                });
                if (!opening)
                    return (0, response_1.errorResponse)(res, "Not found", 404);
                const metadata = JSON.parse(JSON.stringify(opening.metadata || {}));
                metadata.approvalStatus = "declined";
                metadata.declinedByUserId = req.user.id;
                metadata.declinedAt = new Date().toISOString();
                metadata.declineReason = req.body?.reason || null;
                metadata.approvals = [];
                opening.status = "draft";
                opening.metadata = metadata;
                opening.changed("metadata", true);
                await opening.save();
                await auditLog_service_1.AuditLogService.log("DECLINED_JOB_REQUEST", "hr_job_openings", String(opening.id), null, { declinedByUserId: req.user.id }, req);
                (0, response_1.successResponse)(res, opening, "Declined");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.advanceApplicant = async (req, res) => {
            try {
                const { stage } = req.body;
                const result = await this.service.advanceApplicant(req.params.id, req.user.businessId, stage);
                await auditLog_service_1.AuditLogService.log("ADVANCED_APPLICANT", "hr_job_applications", String(result.id), null, { stage }, req);
                (0, response_1.successResponse)(res, result);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.createTemplate = async (req, res) => {
            try {
                const template = await models_1.db.RecruitmentTemplate.create({
                    ...req.body,
                    businessId: req.user.businessId,
                    createdByUserId: req.user.id,
                });
                await auditLog_service_1.AuditLogService.log("CREATED_RECRUITMENT_TEMPLATE", "hr_recruitment_templates", String(template.id), null, {}, req);
                (0, response_1.successResponse)(res, template, "Recruitment template saved.", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listTemplates = async (req, res) => {
            try {
                const limit = Number(req.query.limit || 50);
                const offset = Number(req.query.offset || 0);
                const templates = await models_1.db.RecruitmentTemplate.findAndCountAll({
                    where: { businessId: req.user.businessId },
                    limit,
                    offset,
                    order: [["createdAt", "DESC"]],
                });
                (0, response_1.paginationResponse)(res, templates.rows, templates.count, Math.floor(offset / limit) + 1, limit);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.deleteTemplate = async (req, res) => {
            try {
                const template = await models_1.db.RecruitmentTemplate.findOne({
                    where: {
                        id: req.params.id,
                        businessId: req.user.businessId,
                    },
                });
                if (!template) {
                    return (0, response_1.errorResponse)(res, "Recruitment template not found.", 404);
                }
                await template.destroy();
                await auditLog_service_1.AuditLogService.log("DELETED_RECRUITMENT_TEMPLATE", "hr_recruitment_templates", String(template.id), template.toJSON(), {}, req);
                (0, response_1.successResponse)(res, null, "Recruitment template deleted.");
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
    }
    mapJobRequest(o) {
        const m = o.metadata || {};
        const approvalStatus = (m.approvalStatus || "pending")
            .toString()
            .toLowerCase();
        const mappedStatus = approvalStatus === "approved"
            ? "approved"
            : approvalStatus === "declined"
                ? "declined"
                : "pending";
        const employmentType = (o.employmentType ||
            m.employmentType ||
            "Full-time").toString();
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
        const normalizedPriority = priority === "high" ? "High" : priority === "low" ? "Low" : "Medium";
        const dept = (o.department || m.department || "").toString() || "—";
        const requestedAt = o.createdAt
            ? new Date(o.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
            })
            : "";
        // Normalize to arrays — metadata may store these as strings or other types
        const toArray = (val) => {
            if (Array.isArray(val))
                return val;
            if (typeof val === "string" && val.trim())
                return val.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
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
            overview: o.description || m.overview || m.summary || "No overview provided.",
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
}
exports.RecruitmentController = RecruitmentController;
