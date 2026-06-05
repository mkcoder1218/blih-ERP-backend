"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicRecruitmentRoutes = exports.hrRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const permission_1 = require("../../middlewares/permission");
const requireActiveModule_1 = require("../../middlewares/requireActiveModule");
const asyncHandler_1 = require("../../utils/asyncHandler");
const hr_controller_1 = require("./hr.controller");
const recruitment_controller_1 = require("./recruitment.controller");
const performance_controller_1 = require("./performance.controller");
const validate_1 = require("../../middlewares/validate");
const hrEmployeeRecord_validator_1 = require("../../validators/hrEmployeeRecord.validator");
const router = (0, express_1.Router)();
const controller = new hr_controller_1.HRController();
const recruitmentController = new recruitment_controller_1.RecruitmentController();
const perfController = new performance_controller_1.HRPerformanceController();
// Apply module boundary globally
router.use((0, requireActiveModule_1.requireActiveModule)("hr"));
// Profile mapping
router.post("/templates", auth_1.authRequired, (0, permission_1.requireAnyPermission)("hr.write"), (0, asyncHandler_1.asyncHandler)(controller.seedTemplates));
router.get("/records", auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(controller.listRecords)); // Scope managed in controller
router.get("/records/me", auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(controller.getRecord));
router.post("/records/bulk/validate", auth_1.authRequired, (0, permission_1.requireAnyPermission)("hr.write"), (0, validate_1.validate)(hrEmployeeRecord_validator_1.bulkEmployeeRowsSchema), (0, asyncHandler_1.asyncHandler)(controller.validateBulkEmployeeRecords));
router.post("/records/bulk", auth_1.authRequired, (0, permission_1.requireAnyPermission)("hr.write"), (0, validate_1.validate)(hrEmployeeRecord_validator_1.bulkEmployeeRowsSchema), (0, asyncHandler_1.asyncHandler)(controller.bulkWriteEmployeeRecords));
router.post("/records/onboard", auth_1.authRequired, (0, permission_1.requireAnyPermission)("hr.write"), (0, validate_1.validate)(hrEmployeeRecord_validator_1.createEmployeeRecordSchema), (0, asyncHandler_1.asyncHandler)(controller.onboardEmployee));
router.get("/records/:userId", auth_1.authRequired, (0, permission_1.requireAnyPermission)("hr.read", "hr.write"), (0, asyncHandler_1.asyncHandler)(controller.getRecord));
// Allow HR updates for users with explicit HR write permission or job lifecycle manage permission
router.patch("/records/:userId", auth_1.authRequired, (0, permission_1.requireAnyPermission)("hr.write", "job.manage", "job.update"), (0, validate_1.validate)(hrEmployeeRecord_validator_1.updateEmployeeRecordSchema), (0, asyncHandler_1.asyncHandler)(controller.updateEmployeeRecord));
router.delete("/records/:userId", auth_1.authRequired, (0, permission_1.requireAnyPermission)("hr.write"), (0, asyncHandler_1.asyncHandler)(controller.deleteRecord));
router.get("/organogram", auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(controller.getOrganogram));
router.patch("/records/me", auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(controller.updateSelfRecord));
exports.hrRoutes = router;
// Recruitment Private Routes
router.post("/recruitment/templates", auth_1.authRequired, (0, permission_1.requireAnyPermission)("job_template.manage"), (0, asyncHandler_1.asyncHandler)(recruitmentController.createTemplate));
router.get("/recruitment/templates", auth_1.authRequired, (0, permission_1.requireAnyPermission)("job_template.read", "job_template.manage"), (0, asyncHandler_1.asyncHandler)(recruitmentController.listTemplates));
router.post("/recruitment/templates/seed", auth_1.authRequired, (0, permission_1.requireAnyPermission)("job_template.manage"), (0, asyncHandler_1.asyncHandler)(recruitmentController.seedForms));
router.get("/recruitment/job-openings", auth_1.authRequired, (0, permission_1.requireAnyPermission)("job.read", "job.manage"), (0, asyncHandler_1.asyncHandler)(recruitmentController.listOpenings));
router.post("/recruitment/job-openings", auth_1.authRequired, (0, permission_1.requireAnyPermission)("job.manage"), (0, asyncHandler_1.asyncHandler)(recruitmentController.createOpening));
router.get("/recruitment/job-requests", auth_1.authRequired, (0, permission_1.requireAnyPermission)("job.read", "job.manage"), (0, asyncHandler_1.asyncHandler)(recruitmentController.listJobRequests));
router.get("/recruitment/job-applications", auth_1.authRequired, (0, permission_1.requireAnyPermission)("job.read", "job.manage"), (0, asyncHandler_1.asyncHandler)(recruitmentController.listApplications));
router.post("/recruitment/job-requests/:id/approve", auth_1.authRequired, (0, permission_1.requireAnyPermission)("job.manage"), (0, asyncHandler_1.asyncHandler)(recruitmentController.approveJobRequest));
router.post("/recruitment/job-requests/:id/publish", auth_1.authRequired, (0, permission_1.requireAnyPermission)("job.manage"), (0, asyncHandler_1.asyncHandler)(recruitmentController.publishJob));
router.post("/recruitment/job-requests/:id/close", auth_1.authRequired, (0, permission_1.requireAnyPermission)("job.manage", "job.archive"), (0, asyncHandler_1.asyncHandler)(recruitmentController.closeJob));
router.post("/recruitment/job-requests/:id/decline", auth_1.authRequired, (0, permission_1.requireAnyPermission)("job.manage"), (0, asyncHandler_1.asyncHandler)(recruitmentController.declineJobRequest));
router.patch("/recruitment/applications/:id/stage", auth_1.authRequired, (0, permission_1.requireAnyPermission)("applicant.manage"), (0, asyncHandler_1.asyncHandler)(recruitmentController.advanceApplicant));
router.post("/recruitment/interviews/schedule", auth_1.authRequired, (0, permission_1.requireAnyPermission)("interview.schedule"), (0, asyncHandler_1.asyncHandler)(recruitmentController.scheduleInterview));
router.get("/recruitment/interviews", auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(recruitmentController.listInterviews));
router.get("/recruitment/interviews/:id", auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(recruitmentController.getInterview));
router.patch("/recruitment/interviews/:id", auth_1.authRequired, (0, permission_1.requireAnyPermission)("interview.schedule"), (0, asyncHandler_1.asyncHandler)(recruitmentController.updateInterview));
router.post("/recruitment/interviews/:id/complete-session", auth_1.authRequired, (0, permission_1.requireAnyPermission)("interview.feedback"), (0, asyncHandler_1.asyncHandler)(recruitmentController.completeSession));
router.post("/recruitment/interviews/:id/cancel", auth_1.authRequired, (0, permission_1.requireAnyPermission)("interview.schedule"), (0, asyncHandler_1.asyncHandler)(recruitmentController.cancelInterview));
// Skills
router.get("/recruitment/skills", auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(recruitmentController.listSkills));
router.post("/recruitment/skills", auth_1.authRequired, (0, permission_1.requireAnyPermission)("interview.feedback"), (0, asyncHandler_1.asyncHandler)(recruitmentController.createSkill));
router.delete("/recruitment/skills/:id", auth_1.authRequired, (0, permission_1.requireAnyPermission)("interview.feedback"), (0, asyncHandler_1.asyncHandler)(recruitmentController.deleteSkill));
// Per-interviewer notes (each staff member's own notes, questions, skill ratings, score)
router.get("/recruitment/interviews/:id/my-notes", auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(recruitmentController.getMyNotes));
router.put("/recruitment/interviews/:id/my-notes", auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(recruitmentController.saveMyNotes));
const upload_1 = require("../../middlewares/upload");
// ... (rest of imports)
// Public application endpoint must skip auth
exports.publicRecruitmentRoutes = (0, express_1.Router)();
exports.publicRecruitmentRoutes.get("/jobs/:businessSlug", (0, asyncHandler_1.asyncHandler)(recruitmentController.publicListJobs));
exports.publicRecruitmentRoutes.get("/jobs/:businessSlug/:id", (0, asyncHandler_1.asyncHandler)(recruitmentController.publicGetJob));
exports.publicRecruitmentRoutes.post("/jobs/:businessSlug/:id/view", (0, asyncHandler_1.asyncHandler)(recruitmentController.incrementJobView));
exports.publicRecruitmentRoutes.post("/job-openings/:jobOpeningId/apply", (0, asyncHandler_1.asyncHandler)(recruitmentController.publicApply));
exports.publicRecruitmentRoutes.post("/job-openings/:jobOpeningId/upload-resume", upload_1.upload.single("file"), (0, asyncHandler_1.asyncHandler)(recruitmentController.publicUploadResume));
// Public interview acceptance/decline (no auth — candidate clicks link from email)
exports.publicRecruitmentRoutes.get("/interviews/respond", (0, asyncHandler_1.asyncHandler)(recruitmentController.respondToInterview));
// Performance / Exit
router.post("/performance/templates", auth_1.authRequired, (0, permission_1.requireAnyPermission)("performance.manage"), (0, asyncHandler_1.asyncHandler)(perfController.seedForms));
router.get("/performance/overview", auth_1.authRequired, (0, permission_1.requireAnyPermission)("performance.read", "performance.manage"), (0, asyncHandler_1.asyncHandler)(perfController.overview));
router.get("/performance/reviews", auth_1.authRequired, (0, permission_1.requireAnyPermission)("performance.read", "performance.manage"), (0, asyncHandler_1.asyncHandler)(perfController.listReviews));
router.get("/performance/project-dashboard", auth_1.authRequired, (0, permission_1.requireAnyPermission)("performance.read", "performance.manage"), (0, asyncHandler_1.asyncHandler)(perfController.projectDashboard));
router.get("/performance/evaluations/:employeeUserId/project-evidence", auth_1.authRequired, (0, permission_1.requireAnyPermission)("performance.read", "performance.manage", "performance.self"), (0, asyncHandler_1.asyncHandler)(perfController.employeeEvaluationEvidence));
router.post("/performance/reviews/:reviewId/project-evidence", auth_1.authRequired, (0, permission_1.requireAnyPermission)("performance.manage"), (0, asyncHandler_1.asyncHandler)(perfController.attachProjectEvidenceToReview));
router.post("/training", auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(perfController.createTrainingRequest));
router.get("/disciplinary", auth_1.authRequired, (0, permission_1.requireAnyPermission)("performance.read", "performance.manage"), (0, asyncHandler_1.asyncHandler)(perfController.listDisciplinary));
router.post("/exit/resign", auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(perfController.submitResignation));
router.get("/exit", auth_1.authRequired, (0, permission_1.requireAnyPermission)("hr.read", "hr.write"), (0, asyncHandler_1.asyncHandler)(perfController.listExitProcesses));
router.patch("/exit/:id/status", auth_1.authRequired, (0, permission_1.requireAnyPermission)("hr.write"), (0, asyncHandler_1.asyncHandler)(perfController.updateExitStatus));
