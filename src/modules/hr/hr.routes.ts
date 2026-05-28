import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/role";
import { requireAnyPermission } from "../../middlewares/permission";
import { requireActiveModule } from "../../middlewares/requireActiveModule";
import { asyncHandler } from "../../utils/asyncHandler";
import { HRController } from "./hr.controller";
import { RecruitmentController } from "./recruitment.controller";
import { HRPerformanceController } from "./performance.controller";
import { validate } from "../../middlewares/validate";
import { updateEmployeeRecordSchema } from "../../validators/hrEmployeeRecord.validator";

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
  requireRole("HR_MANAGER", "BUSINESS_ADMIN"),
  asyncHandler(controller.seedTemplates),
);
router.get("/records", authRequired, asyncHandler(controller.listRecords)); // Scope managed in controller
router.get("/records/me", authRequired, asyncHandler(controller.getRecord));
router.post(
  "/records/onboard",
  authRequired,
  requireRole("HR_MANAGER", "BUSINESS_ADMIN"),
  asyncHandler(controller.onboardEmployee),
);
router.get(
  "/records/:userId",
  authRequired,
  requireRole("HR_MANAGER", "BUSINESS_ADMIN", "DEPARTMENT_HEAD"),
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
  requireRole("HR_MANAGER", "BUSINESS_ADMIN"),
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
  requireRole("HR_MANAGER", "BUSINESS_ADMIN"),
  asyncHandler(recruitmentController.createTemplate),
);
router.get(
  "/recruitment/templates",
  authRequired,
  asyncHandler(recruitmentController.listTemplates),
);
router.post(
  "/recruitment/templates/seed",
  authRequired,
  requireRole("HR_MANAGER", "BUSINESS_ADMIN"),
  asyncHandler(recruitmentController.seedForms),
);
router.get(
  "/recruitment/job-openings",
  authRequired,
  asyncHandler(recruitmentController.listOpenings),
);
router.post(
  "/recruitment/job-openings",
  authRequired,
  requireRole("HR_MANAGER", "BUSINESS_ADMIN"),
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
  "/recruitment/job-requests/:id/decline",
  authRequired,
  requireAnyPermission("job.manage"),
  asyncHandler(recruitmentController.declineJobRequest),
);
router.patch(
  "/recruitment/applications/:id/stage",
  authRequired,
  requireRole("HR_MANAGER", "BUSINESS_ADMIN"),
  asyncHandler(recruitmentController.advanceApplicant),
);
router.post(
  "/recruitment/interviews/schedule",
  authRequired,
  requireRole("HR_MANAGER", "BUSINESS_ADMIN", "DEPARTMENT_HEAD"),
  asyncHandler(recruitmentController.scheduleInterview),
);
router.get(
  "/recruitment/interviews",
  authRequired,
  asyncHandler(recruitmentController.listInterviews),
);

import { upload } from "../../middlewares/upload";

// ... (rest of imports)

// Public application endpoint must skip auth
export const publicRecruitmentRoutes = Router();
publicRecruitmentRoutes.get(
  "/jobs",
  asyncHandler(recruitmentController.publicListJobs),
);
publicRecruitmentRoutes.get(
  "/jobs/:id",
  asyncHandler(recruitmentController.publicGetJob),
);
publicRecruitmentRoutes.post(
  "/jobs/:id/view",
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

// Performance / Exit
router.post(
  "/performance/templates",
  authRequired,
  requireRole("HR_MANAGER", "BUSINESS_ADMIN"),
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
  asyncHandler(perfController.listDisciplinary),
);
router.post(
  "/exit/resign",
  authRequired,
  asyncHandler(perfController.submitResignation),
);
router.patch(
  "/exit/:id/status",
  authRequired,
  requireRole("HR_MANAGER", "BUSINESS_ADMIN"),
  asyncHandler(perfController.updateExitStatus),
);
