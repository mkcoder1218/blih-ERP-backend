"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approvalWorkflowRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const role_1 = require("../../middlewares/role");
const validate_1 = require("../../middlewares/validate");
const asyncHandler_1 = require("../../utils/asyncHandler");
const approvalWorkflow_validator_1 = require("../../validators/approvalWorkflow.validator");
const workflow_controller_1 = require("./workflow.controller");
const router = (0, express_1.Router)();
const controller = new workflow_controller_1.WorkflowController();
router.use(auth_1.authRequired);
/**
 * @openapi
 * /api/approval-workflows:
 *   get:
 *     tags: [approvalWorkflow]
 *     summary: GET index
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
router.get('/', (0, role_1.requireRole)('BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.list));
/**
 * @openapi
 * /api/approval-workflows/{id}:
 *   get:
 *     tags: [approvalWorkflow]
 *     summary: GET /:id
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
router.get('/:id', (0, role_1.requireRole)('BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.get));
/**
 * @openapi
 * /api/approval-workflows:
 *   post:
 *     tags: [approvalWorkflow]
 *     summary: POST index
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
router.post('/', (0, role_1.requireRole)('BUSINESS_ADMIN'), (0, validate_1.validate)(approvalWorkflow_validator_1.createWorkflowSchema), (0, asyncHandler_1.asyncHandler)(controller.create));
/**
 * @openapi
 * /api/approval-workflows/steps:
 *   post:
 *     tags: [approvalWorkflow]
 *     summary: POST /steps
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
router.post('/steps', (0, role_1.requireRole)('BUSINESS_ADMIN'), (0, validate_1.validate)(approvalWorkflow_validator_1.createStepSchema), (0, asyncHandler_1.asyncHandler)(controller.createStep));
exports.approvalWorkflowRoutes = router;
