"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportingRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const asyncHandler_1 = require("../../utils/asyncHandler");
const reporting_controller_1 = require("./reporting.controller");
const router = (0, express_1.Router)();
const controller = new reporting_controller_1.ReportingController();
router.use(auth_1.authRequired); // Globally accessible framework module, though role enforcement may happen on route mapping
// Report Definitions
/**
 * @openapi
 * /api/v1/reporting/definitions:
 *   post:
 *     tags: [reporting]
 *     summary: POST /definitions
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
router.post('/definitions', (0, asyncHandler_1.asyncHandler)(controller.createDefinition));
/**
 * @openapi
 * /api/v1/reporting/definitions:
 *   get:
 *     tags: [reporting]
 *     summary: GET /definitions
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
router.get('/definitions', (0, asyncHandler_1.asyncHandler)(controller.listDefinitions));
/**
 * @openapi
 * /api/v1/reporting/definitions/{id}:
 *   patch:
 *     tags: [reporting]
 *     summary: PATCH /definitions/:id
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
router.patch('/definitions/:id', (0, asyncHandler_1.asyncHandler)(controller.updateDefinition));
// Running Reports
/**
 * @openapi
 * /api/v1/reporting/definitions/{id}/run:
 *   post:
 *     tags: [reporting]
 *     summary: POST /definitions/:id/run
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
router.post('/definitions/:id/run', (0, asyncHandler_1.asyncHandler)(controller.runReport));
/**
 * @openapi
 * /api/v1/reporting/definitions/{id}/runs:
 *   get:
 *     tags: [reporting]
 *     summary: GET /definitions/:id/runs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
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
router.get('/definitions/:id/runs', (0, asyncHandler_1.asyncHandler)(controller.listReportRuns));
// Metrics
/**
 * @openapi
 * /api/v1/reporting/metrics/generate:
 *   post:
 *     tags: [reporting]
 *     summary: POST /metrics/generate
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
router.post('/metrics/generate', (0, asyncHandler_1.asyncHandler)(controller.generateBasicMetrics));
/**
 * @openapi
 * /api/v1/reporting/metrics:
 *   get:
 *     tags: [reporting]
 *     summary: GET /metrics
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
router.get('/metrics', (0, asyncHandler_1.asyncHandler)(controller.getMetrics));
exports.reportingRoutes = router;
