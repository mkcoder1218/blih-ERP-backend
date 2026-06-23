import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireAnyPermission } from "../../middlewares/permission";
import { requireActiveModule } from "../../middlewares/requireActiveModule";
import { asyncHandler } from "../../utils/asyncHandler";
import { HRController } from "./hr.controller";
import { RecruitmentController } from "./recruitment.controller";
import { HRPerformanceController } from "./performance.controller";
import { validate } from "../../middlewares/validate";
import { bulkEmployeeRowsSchema, createEmployeeRecordSchema, updateEmployeeRecordSchema } from "../../validators/hrEmployeeRecord.validator";

const router = Router();
const controller = new HRController();
const recruitmentController = new RecruitmentController();
const perfController = new HRPerformanceController();

// Apply module boundary globally
router.use(requireActiveModule("hr"));

// Profile mapping
router.post(
  "/templates",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(controller.seedTemplates),
);
router.get("/records", authRequired, asyncHandler(controller.listRecords)); // Scope managed in controller
router.get("/records/me", authRequired, asyncHandler(controller.getRecord));
router.get(
  "/forms",
  authRequired,
  requireAnyPermission("hr.read", "hr.write", "exit.self"),
  asyncHandler(perfController.listExitForms),
);
router.post(
  "/forms",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(perfController.createExitForm),
);
router.patch(
  "/forms/:id",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(perfController.updateExitForm),
);
router.delete(
  "/forms/:id",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(perfController.deleteExitForm),
);
router.get(
  "/forms/:id/download",
  authRequired,
  requireAnyPermission("hr.read", "hr.write", "exit.self"),
  asyncHandler(perfController.downloadExitForm),
);
router.post(
  "/records/bulk/validate",
  authRequired,
  requireAnyPermission("hr.write"),
  validate(bulkEmployeeRowsSchema),
  asyncHandler(controller.validateBulkEmployeeRecords),
);
router.post(
  "/records/bulk",
  authRequired,
  requireAnyPermission("hr.write"),
  validate(bulkEmployeeRowsSchema),
  asyncHandler(controller.bulkWriteEmployeeRecords),
);
router.post(
  "/records/onboard",
  authRequired,
  requireAnyPermission("hr.write"),
  validate(createEmployeeRecordSchema),
  asyncHandler(controller.onboardEmployee),
);
router.get(
  "/records/:userId",
  authRequired,
  requireAnyPermission("hr.read", "hr.write"),
  asyncHandler(controller.getRecord),
);
// Allow HR updates for users with explicit HR write permission or job lifecycle manage permission
router.patch(
  "/records/:userId",
  authRequired,
  requireAnyPermission("hr.write", "job.manage", "job.update"),
  validate(updateEmployeeRecordSchema),
  asyncHandler(controller.updateEmployeeRecord),
);
router.delete(
  "/records/:userId",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(controller.deleteRecord),
);
router.get("/organogram", authRequired, asyncHandler(controller.getOrganogram));
router.patch(
  "/records/me",
  authRequired,
  asyncHandler(controller.updateSelfRecord),
);

// -- Pending Self-Registrations -- HR Approval Workflow
router.get(
  "/pending-registrations",
  authRequired,
  requireAnyPermission("hr.read", "hr.write"),
  asyncHandler(controller.listPendingRegistrations),
);
router.get(
  "/pending-registrations/:userId",
  authRequired,
  requireAnyPermission("hr.read", "hr.write"),
  asyncHandler(controller.getPendingRegistration),
);
router.post(
  "/pending-registrations/:userId/approve",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(controller.approveRegistration),
);
router.post(
  "/pending-registrations/:userId/reject",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(controller.rejectRegistration),
);

export const hrRoutes = router;

// Recruitment Private Routes
router.post(
  "/recruitment/templates",
  authRequired,
  requireAnyPermission("job_template.manage"),
  asyncHandler(recruitmentController.createTemplate),
);
router.get(
  "/recruitment/templates",
  authRequired,
  requireAnyPermission("job_template.read", "job_template.manage"),
  asyncHandler(recruitmentController.listTemplates),
);
router.delete(
  "/recruitment/templates/:id",
  authRequired,
  requireAnyPermission("job_template.manage"),
  asyncHandler(recruitmentController.deleteTemplate),
);
router.post(
  "/recruitment/templates/seed",
  authRequired,
  requireAnyPermission("job_template.manage"),
  asyncHandler(recruitmentController.seedForms),
);
router.get(
  "/recruitment/job-openings",
  authRequired,
  requireAnyPermission("job.read", "job.manage"),
  asyncHandler(recruitmentController.listOpenings),
);
router.post(
  "/recruitment/job-openings",
  authRequired,
  requireAnyPermission("job.manage"),
  asyncHandler(recruitmentController.createOpening),
);
router.get(
  "/recruitment/job-requests",
  authRequired,
  requireAnyPermission("job.read", "job.manage"),
  asyncHandler(recruitmentController.listJobRequests),
);
router.get(
  "/recruitment/job-applications",
  authRequired,
  requireAnyPermission("job.read", "job.manage"),
  asyncHandler(recruitmentController.listApplications),
);
router.post(
  "/recruitment/job-requests/:id/approve",
  authRequired,
  requireAnyPermission("job.manage"),
  asyncHandler(recruitmentController.approveJobRequest),
);
router.post(
  "/recruitment/job-requests/:id/publish",
  authRequired,
  requireAnyPermission("job.manage"),
  asyncHandler(recruitmentController.publishJob),
);
router.post(
  "/recruitment/job-requests/:id/close",
  authRequired,
  requireAnyPermission("job.manage", "job.archive"),
  asyncHandler(recruitmentController.closeJob),
);
router.post(
  "/recruitment/job-requests/:id/decline",
  authRequired,
  requireAnyPermission("job.manage"),
  asyncHandler(recruitmentController.declineJobRequest),
);
router.patch(
  "/recruitment/applications/:id/stage",
  authRequired,
  requireAnyPermission("applicant.manage"),
  asyncHandler(recruitmentController.advanceApplicant),
);
router.post(
  "/recruitment/interviews/schedule",
  authRequired,
  requireAnyPermission("interview.schedule"),
  asyncHandler(recruitmentController.scheduleInterview),
);
router.get(
  "/recruitment/interviews",
  authRequired,
  asyncHandler(recruitmentController.listInterviews),
);
router.get(
  "/recruitment/interviews/:id",
  authRequired,
  asyncHandler(recruitmentController.getInterview),
);
router.patch(
  "/recruitment/interviews/:id",
  authRequired,
  requireAnyPermission("interview.schedule"),
  asyncHandler(recruitmentController.updateInterview),
);
router.post(
  "/recruitment/interviews/:id/complete-session",
  authRequired,
  requireAnyPermission("interview.feedback"),
  asyncHandler(recruitmentController.completeSession),
);
router.post(
  "/recruitment/interviews/:id/cancel",
  authRequired,
  requireAnyPermission("interview.schedule"),
  asyncHandler(recruitmentController.cancelInterview),
);

// Skills
router.get(
  "/recruitment/skills",
  authRequired,
  asyncHandler(recruitmentController.listSkills),
);
router.post(
  "/recruitment/skills",
  authRequired,
  requireAnyPermission("interview.feedback"),
  asyncHandler(recruitmentController.createSkill),
);
router.delete(
  "/recruitment/skills/:id",
  authRequired,
  requireAnyPermission("interview.feedback"),
  asyncHandler(recruitmentController.deleteSkill),
);

// Per-interviewer notes (each staff member's own notes, questions, skill ratings, score)
router.get(
  "/recruitment/interviews/:id/my-notes",
  authRequired,
  asyncHandler(recruitmentController.getMyNotes),
);
router.put(
  "/recruitment/interviews/:id/my-notes",
  authRequired,
  asyncHandler(recruitmentController.saveMyNotes),
);

import { upload } from "../../middlewares/upload";

// ... (rest of imports)

// Public application endpoint must skip auth
export const publicRecruitmentRoutes = Router();
publicRecruitmentRoutes.get(
  "/jobs/:businessSlug",
  asyncHandler(recruitmentController.publicListJobs),
);
publicRecruitmentRoutes.get(
  "/jobs/:businessSlug/:id",
  asyncHandler(recruitmentController.publicGetJob),
);
publicRecruitmentRoutes.post(
  "/jobs/:businessSlug/:id/view",
  asyncHandler(recruitmentController.incrementJobView),
);
publicRecruitmentRoutes.post(
  "/job-openings/:jobOpeningId/apply",
  asyncHandler(recruitmentController.publicApply),
);
publicRecruitmentRoutes.post(
  "/job-openings/:jobOpeningId/upload-resume",
  upload.single("file"),
  asyncHandler(recruitmentController.publicUploadResume),
);

// Public interview acceptance/decline (no auth â€” candidate clicks link from email)
publicRecruitmentRoutes.get(
  "/interviews/respond",
  asyncHandler(recruitmentController.respondToInterview),
);

// Performance / Exit
router.post(
  "/performance/templates",
  authRequired,
  requireAnyPermission("performance.manage"),
  asyncHandler(perfController.seedForms),
);
router.get(
  "/performance/overview",
  authRequired,
  requireAnyPermission("performance.read", "performance.manage"),
  asyncHandler(perfController.overview),
);
router.get(
  "/performance/reviews",
  authRequired,
  requireAnyPermission("performance.read", "performance.manage"),
  asyncHandler(perfController.listReviews),
);
router.get(
  "/performance/project-dashboard",
  authRequired,
  requireAnyPermission("performance.read", "performance.manage"),
  asyncHandler(perfController.projectDashboard),
);
router.get(
  "/performance/evaluations/:employeeUserId/project-evidence",
  authRequired,
  requireAnyPermission("performance.read", "performance.manage", "performance.self"),
  asyncHandler(perfController.employeeEvaluationEvidence),
);
router.post(
  "/performance/reviews/:reviewId/project-evidence",
  authRequired,
  requireAnyPermission("performance.manage"),
  asyncHandler(perfController.attachProjectEvidenceToReview),
);
router.post(
  "/training",
  authRequired,
  asyncHandler(perfController.createTrainingRequest),
);
router.get(
  "/training",
  authRequired,
  asyncHandler(perfController.listTrainingRequests),
);
router.post(
  "/training/:id/approve",
  authRequired,
  requireAnyPermission("performance.manage", "performance.read"),
  asyncHandler(perfController.approveTrainingRequest),
);
router.post(
  "/training/:id/reject",
  authRequired,
  requireAnyPermission("performance.manage", "performance.read"),
  asyncHandler(perfController.rejectTrainingRequest),
);
router.post(
  "/promotions",
  authRequired,
  asyncHandler(perfController.createPromotionRequest),
);
router.get(
  "/promotions",
  authRequired,
  asyncHandler(perfController.listPromotionRequests),
);
router.post(
  "/promotions/:id/approve",
  authRequired,
  requireAnyPermission("performance.manage"),
  asyncHandler(perfController.approvePromotionRequest),
);
router.post(
  "/promotions/:id/reject",
  authRequired,
  requireAnyPermission("performance.manage"),
  asyncHandler(perfController.rejectPromotionRequest),
);
router.get(
  "/disciplinary",
  authRequired,
  requireAnyPermission("performance.self", "performance.read", "performance.manage"),
  asyncHandler(perfController.listDisciplinaryCases),
);
router.post(
  "/disciplinary/analyze-attendance",
  authRequired,
  requireAnyPermission("performance.manage", "attendance.manage"),
  asyncHandler(perfController.analyzeAttendanceDiscipline),
);
router.post(
  "/disciplinary/analyze-attendance/send",
  authRequired,
  requireAnyPermission("performance.manage", "attendance.manage"),
  asyncHandler(perfController.sendAttendanceDisciplineAnalysis),
);
router.delete(
  "/disciplinary/analyze-attendance",
  authRequired,
  requireAnyPermission("performance.manage", "attendance.manage"),
  asyncHandler(perfController.resetAttendanceDisciplineAnalysis),
);
router.post(
  "/disciplinary",
  authRequired,
  requireAnyPermission("performance.manage", "hr.write"),
  asyncHandler(perfController.createDisciplinaryCase),
);
router.patch(
  "/disciplinary/:id",
  authRequired,
  requireAnyPermission("performance.manage", "hr.write"),
  asyncHandler(perfController.updateDisciplinaryCase),
);
router.post(
  "/exit/resign",
  authRequired,
  asyncHandler(perfController.submitResignation),
);
router.post(
  "/exit",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(perfController.createExitProcess),
);
router.get(
  "/exit",
  authRequired,
  requireAnyPermission("hr.read", "hr.write"),
  asyncHandler(perfController.listExitProcesses),
);
router.get(
  "/exit/analytics",
  authRequired,
  requireAnyPermission("hr.read", "hr.write"),
  asyncHandler(perfController.getExitAnalytics),
);
router.get(
  "/exit/interviews",
  authRequired,
  requireAnyPermission("hr.read", "hr.write"),
  asyncHandler(perfController.listExitInterviews),
);
router.patch(
  "/exit/interviews/:interviewId",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(perfController.updateExitInterview),
);
router.post(
  "/exit/interviews/:interviewId/complete",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(perfController.completeExitInterview),
);
router.post(
  "/exit/interviews/:interviewId/send-reminder",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(perfController.sendExitInterviewReminder),
);
router.get(
  "/exit/me",
  authRequired,
  asyncHandler(perfController.getMyExitProcess),
);
router.post(
  "/exit/:id/interviews",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(perfController.createExitInterview),
);
router.get(
  "/exit/:id/documents",
  authRequired,
  requireAnyPermission("hr.read", "hr.write", "exit.self"),
  asyncHandler(perfController.listExitDocuments),
);
router.post(
  "/exit/:id/documents/:documentId/upload",
  authRequired,
  requireAnyPermission("hr.write"),
  upload.single("file"),
  asyncHandler(perfController.uploadExitDocument),
);
router.post(
  "/exit/:id/documents/:documentId/verify",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(perfController.verifyExitDocument),
);
router.patch(
  "/exit/:id/documents/:documentId",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(perfController.updateExitDocument),
);
router.get(
  "/exit/:id/documents/download-all",
  authRequired,
  requireAnyPermission("hr.read", "hr.write", "exit.self"),
  asyncHandler(perfController.downloadExitDocuments),
);
router.get(
  "/exit/:id",
  authRequired,
  requireAnyPermission("hr.read", "hr.write"),
  asyncHandler(perfController.getExitProcess),
);
router.patch(
  "/exit/:id",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(perfController.updateExitProcess),
);
router.get(
  "/exit/:id/timeline",
  authRequired,
  requireAnyPermission("hr.read", "hr.write", "exit.self"),
  asyncHandler(perfController.getExitTimeline),
);
router.patch(
  "/exit/:id/final-pay",
  authRequired,
  requireAnyPermission("hr.write", "finance.manage", "payroll.run"),
  asyncHandler(perfController.updateExitFinalPay),
);
router.get(
  "/exit/:id/clearance",
  authRequired,
  requireAnyPermission("hr.write", "exit.self"),
  asyncHandler(perfController.listExitClearance),
);
router.post(
  "/exit/:id/clearance/:stepId/complete",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(perfController.completeExitClearanceStep),
);
router.post(
  "/exit/:id/clearance/:stepId/waive",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(perfController.waiveExitClearanceStep),
);
router.patch(
  "/exit/:id/clearance/:stepId",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(perfController.updateExitClearanceStep),
);
router.patch(
  "/exit/:id/status",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(perfController.updateExitStatus),
);
router.post(
  "/exit/:id/offboarding-form/send",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(perfController.sendOffboardingForm),
);
router.post(
  "/exit/:id/offboarding-form",
  authRequired,
  asyncHandler(perfController.submitOffboardingForm),
);
router.post(
  "/exit/:id/approve",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(perfController.approveExitRequest),
);
router.post(
  "/exit/:id/reject",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(perfController.rejectExitRequest),
);
router.post(
  "/exit/:id/disable-account",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(perfController.disableExitAccount),
);

