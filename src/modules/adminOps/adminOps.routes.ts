
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { asyncHandler } from '../../utils/asyncHandler';
import { AdminOpsController } from './adminOps.controller';

const router = Router();
const controller = new AdminOpsController();

// Support Logs - Admin visible
/**
 * @openapi
 * /api/v1/admin-ops/support-logs:
 *   get:
 *     tags: [admin-ops]
 *     summary: GET /support-logs
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
router.get('/support-logs', authRequired, requireRole('BUSINESS_ADMIN', 'SUPER_ADMIN'), asyncHandler(controller.listSupportLogs));

// System Health - Platform Admins
/**
 * @openapi
 * /api/v1/admin-ops/health:
 *   get:
 *     tags: [admin-ops]
 *     summary: GET /health
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
router.get('/health', authRequired, requireRole('SUPER_ADMIN'), asyncHandler(controller.checkHealth));

// Jobs - Mixed vis
/**
 * @openapi
 * /api/v1/admin-ops/jobs:
 *   get:
 *     tags: [admin-ops]
 *     summary: GET /jobs
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
router.get('/jobs', authRequired, requireRole('BUSINESS_ADMIN', 'SUPER_ADMIN'), asyncHandler(controller.listJobs));

// PLATFORM SUPPORT SPECIFIC (Only SUPER_ADMIN)
/**
 * @openapi
 * /api/v1/admin-ops/support-access:
 *   post:
 *     tags: [admin-ops]
 *     summary: POST /support-access
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
router.post('/support-access', authRequired, requireRole('SUPER_ADMIN'), asyncHandler(controller.requestSupport));
/**
 * @openapi
 * /api/v1/admin-ops/support-access/{id}/end:
 *   post:
 *     tags: [admin-ops]
 *     summary: POST /support-access/:id/end
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
router.post('/support-access/:id/end', authRequired, requireRole('SUPER_ADMIN'), asyncHandler(controller.endSupport));

/**
 * @openapi
 * /api/v1/admin-ops/impersonate:
 *   post:
 *     tags: [admin-ops]
 *     summary: POST /impersonate
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
router.post('/impersonate', authRequired, requireRole('SUPER_ADMIN'), asyncHandler(controller.startImpersonation));
/**
 * @openapi
 * /api/v1/admin-ops/impersonate/{id}/end:
 *   post:
 *     tags: [admin-ops]
 *     summary: POST /impersonate/:id/end
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
router.post('/impersonate/:id/end', authRequired, requireRole('SUPER_ADMIN'), asyncHandler(controller.endImpersonation));

export const adminOpsRoutes = router;
