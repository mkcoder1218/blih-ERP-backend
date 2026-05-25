"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.okrRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const role_1 = require("../../middlewares/role");
const module_1 = require("../../middlewares/module");
const asyncHandler_1 = require("../../utils/asyncHandler");
const okr_controller_1 = require("./okr.controller");
const router = (0, express_1.Router)();
const controller = new okr_controller_1.OKRController();
router.use(auth_1.authRequired, (0, module_1.requireActiveModule)('okr'));
// Objective
/**
 * @openapi
 * /api/v1/okr/objectives:
 *   post:
 *     tags: [okr]
 *     summary: POST /objectives
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
router.post('/objectives', (0, asyncHandler_1.asyncHandler)(controller.createObjective));
/**
 * @openapi
 * /api/v1/okr/objectives:
 *   get:
 *     tags: [okr]
 *     summary: GET /objectives
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
router.get('/objectives', (0, asyncHandler_1.asyncHandler)(controller.listObjectives));
/**
 * @openapi
 * /api/v1/okr/objectives/{id}:
 *   get:
 *     tags: [okr]
 *     summary: GET /objectives/:id
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
router.get('/objectives/:id', (0, asyncHandler_1.asyncHandler)(controller.getObjective));
/**
 * @openapi
 * /api/v1/okr/objectives/{id}:
 *   patch:
 *     tags: [okr]
 *     summary: PATCH /objectives/:id
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
router.patch('/objectives/:id', (0, asyncHandler_1.asyncHandler)(controller.updateObjective));
// Key Result
/**
 * @openapi
 * /api/v1/okr/key-results:
 *   post:
 *     tags: [okr]
 *     summary: POST /key-results
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
router.post('/key-results', (0, asyncHandler_1.asyncHandler)(controller.createKeyResult));
/**
 * @openapi
 * /api/v1/okr/key-results/{id}:
 *   patch:
 *     tags: [okr]
 *     summary: PATCH /key-results/:id
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
router.patch('/key-results/:id', (0, asyncHandler_1.asyncHandler)(controller.updateKeyResult));
// Progress Update
/**
 * @openapi
 * /api/v1/okr/progress:
 *   post:
 *     tags: [okr]
 *     summary: POST /progress
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
router.post('/progress', (0, asyncHandler_1.asyncHandler)(controller.logProgressUpdate));
// Evaluation
/**
 * @openapi
 * /api/v1/okr/evaluations:
 *   post:
 *     tags: [okr]
 *     summary: POST /evaluations
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
router.post('/evaluations', (0, role_1.requireRole)('HR_MANAGER', 'BUSINESS_ADMIN', 'DEPARTMENT_HEAD'), (0, asyncHandler_1.asyncHandler)(controller.evaluateObjective));
exports.okrRoutes = router;
