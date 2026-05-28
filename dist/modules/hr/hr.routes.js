"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicRecruitmentRoutes = exports.hrRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const role_1 = require("../../middlewares/role");
const requireActiveModule_1 = require("../../middlewares/requireActiveModule");
const asyncHandler_1 = require("../../utils/asyncHandler");
const hr_controller_1 = require("./hr.controller");
const recruitment_controller_1 = require("./recruitment.controller");
const performance_controller_1 = require("./performance.controller");
const router = (0, express_1.Router)();
const controller = new hr_controller_1.HRController();
const recruitmentController = new recruitment_controller_1.RecruitmentController();
const perfController = new performance_controller_1.HRPerformanceController();
// Apply module boundary globally
router.use((0, requireActiveModule_1.requireActiveModule)('hr'));
// Profile mapping
/**
 * @openapi
 * /api/v1/hr/templates:
 *   post:
 *     tags: [hr]
 *     summary: POST /templates
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/templates', auth_1.authRequired, (0, role_1.requireRole)('HR_MANAGER', 'BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.seedTemplates));
/**
 * @openapi
 * /api/v1/hr/records:
 *   get:
 *     tags: [hr]
 *     summary: GET /records
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.get('/records', auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(controller.listRecords)); // Scope managed in controller
/**
 * @openapi
 * /api/v1/hr/records/me:
 *   get:
 *     tags: [hr]
 *     summary: GET /records/me
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.get('/records/me', auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(controller.getRecord));
/**
 * @openapi
 * /api/v1/hr/records/onboard:
 *   post:
 *     tags: [hr]
 *     summary: POST /records/onboard
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 */
router.post('/records/onboard', auth_1.authRequired, (0, role_1.requireRole)('HR_MANAGER', 'BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.onboardEmployee));
/**
 * @openapi
 * /api/v1/hr/records/{userId}:
 *   get:
 *     tags: [hr]
 *     summary: GET /records/:userId
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.get('/records/:userId', auth_1.authRequired, (0, role_1.requireRole)('HR_MANAGER', 'BUSINESS_ADMIN', 'DEPARTMENT_HEAD'), (0, asyncHandler_1.asyncHandler)(controller.getRecord));
// Self-mutating restricted attributes
/**
 * @openapi
 * /api/v1/hr/records/me:
 *   patch:
 *     tags: [hr]
 *     summary: PATCH /records/me
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.patch('/records/me', auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(controller.updateSelfRecord));
exports.hrRoutes = router;
/**
 * @openapi
 * /api/v1/hr/recruitment/templates:
 *   post:
 *     tags: [hr]
 *     summary: POST /recruitment/templates
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/recruitment/templates', auth_1.authRequired, (0, role_1.requireRole)('HR_MANAGER', 'BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(recruitmentController.seedForms));
/**
 * @openapi
 * /api/v1/hr/recruitment/job-openings:
 *   get:
 *     tags: [hr]
 *     summary: GET /recruitment/job-openings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.get('/recruitment/job-openings', auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(recruitmentController.listOpenings));
/**
 * @openapi
 * /api/v1/hr/recruitment/job-openings:
 *   post:
 *     tags: [hr]
 *     summary: POST /recruitment/job-openings
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/recruitment/job-openings', auth_1.authRequired, (0, role_1.requireRole)('HR_MANAGER', 'BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(recruitmentController.createOpening));
/**
 * @openapi
 * /api/v1/hr/recruitment/applications/{id}/stage:
 *   patch:
 *     tags: [hr]
 *     summary: PATCH /recruitment/applications/:id/stage
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.patch('/recruitment/applications/:id/stage', auth_1.authRequired, (0, role_1.requireRole)('HR_MANAGER', 'BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(recruitmentController.advanceApplicant));
// Public application endpoint must skip auth
exports.publicRecruitmentRoutes = (0, express_1.Router)();
exports.publicRecruitmentRoutes.post('/job-openings/:jobOpeningId/apply', (0, asyncHandler_1.asyncHandler)(recruitmentController.publicApply));
// Performance / Exit
/**
 * @openapi
 * /api/v1/hr/performance/templates:
 *   post:
 *     tags: [hr]
 *     summary: POST /performance/templates
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/performance/templates', auth_1.authRequired, (0, role_1.requireRole)('HR_MANAGER', 'BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(perfController.seedForms));
// Training accessible by employees structuring bounds natively
/**
 * @openapi
 * /api/v1/hr/training:
 *   post:
 *     tags: [hr]
 *     summary: POST /training
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/training', auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(perfController.createTrainingRequest));
// Strict Disciplinary limits natively handled in Controller
/**
 * @openapi
 * /api/v1/hr/disciplinary:
 *   get:
 *     tags: [hr]
 *     summary: GET /disciplinary
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.get('/disciplinary', auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(perfController.listDisciplinary));
// Exits
/**
 * @openapi
 * /api/v1/hr/exit/resign:
 *   post:
 *     tags: [hr]
 *     summary: POST /exit/resign
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/exit/resign', auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(perfController.submitResignation));
/**
 * @openapi
 * /api/v1/hr/exit/{id}/status:
 *   patch:
 *     tags: [hr]
 *     summary: PATCH /exit/:id/status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.patch('/exit/:id/status', auth_1.authRequired, (0, role_1.requireRole)('HR_MANAGER', 'BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(perfController.updateExitStatus));
