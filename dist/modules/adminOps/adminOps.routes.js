"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminOpsRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const role_1 = require("../../middlewares/role");
const asyncHandler_1 = require("../../utils/asyncHandler");
const adminOps_controller_1 = require("./adminOps.controller");
const router = (0, express_1.Router)();
const controller = new adminOps_controller_1.AdminOpsController();
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
router.get('/support-logs', auth_1.authRequired, (0, role_1.requireRole)('BUSINESS_ADMIN', 'SUPER_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.listSupportLogs));
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
router.get('/health', auth_1.authRequired, (0, role_1.requireRole)('SUPER_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.checkHealth));
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
router.get('/jobs', auth_1.authRequired, (0, role_1.requireRole)('BUSINESS_ADMIN', 'SUPER_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.listJobs));
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
router.post('/support-access', auth_1.authRequired, (0, role_1.requireRole)('SUPER_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.requestSupport));
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
router.post('/support-access/:id/end', auth_1.authRequired, (0, role_1.requireRole)('SUPER_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.endSupport));
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
router.post('/impersonate', auth_1.authRequired, (0, role_1.requireRole)('SUPER_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.startImpersonation));
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
router.post('/impersonate/:id/end', auth_1.authRequired, (0, role_1.requireRole)('SUPER_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.endImpersonation));
exports.adminOpsRoutes = router;
