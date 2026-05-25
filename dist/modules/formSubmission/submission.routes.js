"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formSubmissionRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const validate_1 = require("../../middlewares/validate");
const asyncHandler_1 = require("../../utils/asyncHandler");
const formSubmission_validator_1 = require("../../validators/formSubmission.validator");
const submission_controller_1 = require("./submission.controller");
const router = (0, express_1.Router)();
const controller = new submission_controller_1.SubmissionController();
router.use(auth_1.authRequired);
/**
 * @openapi
 * /api/form-submissions/mine:
 *   get:
 *     tags: [formSubmission]
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
 * /api/form-submissions/{id}:
 *   get:
 *     tags: [formSubmission]
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
 * /api/form-submissions:
 *   post:
 *     tags: [formSubmission]
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
router.post('/', (0, validate_1.validate)(formSubmission_validator_1.submitDataSchema), (0, asyncHandler_1.asyncHandler)(controller.create));
exports.formSubmissionRoutes = router;
