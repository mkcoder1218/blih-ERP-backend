
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { requireActiveModule } from '../../middlewares/requireActiveModule';
import { asyncHandler } from '../../utils/asyncHandler';
import { HRController } from './hr.controller';
import { RecruitmentController } from './recruitment.controller';
import { HRPerformanceController } from './performance.controller';

const router = Router();
const controller = new HRController();
const recruitmentController = new RecruitmentController();
const perfController = new HRPerformanceController();

// Apply module boundary globally
router.use(requireActiveModule('hr'));

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
router.post('/templates', authRequired, requireRole('HR_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.seedTemplates));
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
router.get('/records', authRequired, asyncHandler(controller.listRecords)); // Scope managed in controller
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
router.get('/records/me', authRequired, asyncHandler(controller.getRecord));
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
router.get('/records/:userId', authRequired, requireRole('HR_MANAGER', 'BUSINESS_ADMIN', 'DEPARTMENT_HEAD'), asyncHandler(controller.getRecord));

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
router.patch('/records/me', authRequired, asyncHandler(controller.updateSelfRecord));

export const hrRoutes = router;


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
router.post('/recruitment/templates', authRequired, requireRole('HR_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(recruitmentController.seedForms));
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
router.get('/recruitment/job-openings', authRequired, asyncHandler(recruitmentController.listOpenings));
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
router.post('/recruitment/job-openings', authRequired, requireRole('HR_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(recruitmentController.createOpening));
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
router.patch('/recruitment/applications/:id/stage', authRequired, requireRole('HR_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(recruitmentController.advanceApplicant));

// Public application endpoint must skip auth
export const publicRecruitmentRoutes = Router();
publicRecruitmentRoutes.post('/job-openings/:jobOpeningId/apply', asyncHandler(recruitmentController.publicApply));


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
router.post('/performance/templates', authRequired, requireRole('HR_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(perfController.seedForms));

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
router.post('/training', authRequired, asyncHandler(perfController.createTrainingRequest));

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
router.get('/disciplinary', authRequired, asyncHandler(perfController.listDisciplinary));

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
router.post('/exit/resign', authRequired, asyncHandler(perfController.submitResignation));
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
router.patch('/exit/:id/status', authRequired, requireRole('HR_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(perfController.updateExitStatus));
