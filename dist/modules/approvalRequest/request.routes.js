"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approvalRequestRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const validate_1 = require("../../middlewares/validate");
const asyncHandler_1 = require("../../utils/asyncHandler");
const approvalRequest_validator_1 = require("../../validators/approvalRequest.validator");
const request_controller_1 = require("./request.controller");
const router = (0, express_1.Router)();
const controller = new request_controller_1.RequestController();
router.use(auth_1.authRequired);
/**
 * @openapi
 * /api/approval-requests/mine:
 *   get:
 *     tags: [approvalRequest]
 *     summary: GET /mine
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
router.get('/mine', (0, asyncHandler_1.asyncHandler)(controller.listMine));
/**
 * @openapi
 * /api/approval-requests/{id}:
 *   get:
 *     tags: [approvalRequest]
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
router.get('/:id', (0, asyncHandler_1.asyncHandler)(controller.get));
/**
 * @openapi
 * /api/approval-requests/submit:
 *   post:
 *     tags: [approvalRequest]
 *     summary: POST /submit
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
router.post('/submit', (0, validate_1.validate)(approvalRequest_validator_1.submitRequestSchema), (0, asyncHandler_1.asyncHandler)(controller.submit));
/**
 * @openapi
 * /api/approval-requests/{id}/act:
 *   post:
 *     tags: [approvalRequest]
 *     summary: POST /:id/act
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
router.post('/:id/act', (0, validate_1.validate)(approvalRequest_validator_1.actRequestSchema), (0, asyncHandler_1.asyncHandler)(controller.act));
exports.approvalRequestRoutes = router;
