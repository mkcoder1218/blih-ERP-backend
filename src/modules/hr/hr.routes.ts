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

// Public interview acceptance/decline (no auth — candidate clicks link from email)
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
router.post(
  "/training",
  authRequired,
  asyncHandler(perfController.createTrainingRequest),
);
router.get(
  "/disciplinary",
  authRequired,
  requireAnyPermission("performance.read", "performance.manage"),
  asyncHandler(perfController.listDisciplinary),
);
router.post(
  "/exit/resign",
  authRequired,
  asyncHandler(perfController.submitResignation),
);
router.get(
  "/exit",
  authRequired,
  requireAnyPermission("hr.read", "hr.write"),
  asyncHandler(perfController.listExitProcesses),
);
router.patch(
  "/exit/:id/status",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(perfController.updateExitStatus),
);
