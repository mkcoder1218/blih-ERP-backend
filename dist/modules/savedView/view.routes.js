"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.savedViewRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const validate_1 = require("../../middlewares/validate");
const asyncHandler_1 = require("../../utils/asyncHandler");
const dashboard_validator_1 = require("../../validators/dashboard.validator");
const view_controller_1 = require("./view.controller");
const router = (0, express_1.Router)();
const controller = new view_controller_1.ViewController();
router.use(auth_1.authRequired);
/**
 * @openapi
 * /api/saved-views/mine:
 *   get:
 *     tags: [savedView]
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
router.get('/mine', (0, asyncHandler_1.asyncHandler)(controller.list));
/**
 * @openapi
 * /api/saved-views:
 *   post:
 *     tags: [savedView]
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
router.post('/', (0, validate_1.validate)(dashboard_validator_1.viewSchema), (0, asyncHandler_1.asyncHandler)(controller.create));
/**
 * @openapi
 * /api/saved-views/{id}:
 *   delete:
 *     tags: [savedView]
 *     summary: DELETE /:id
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
router.delete('/:id', (0, asyncHandler_1.asyncHandler)(controller.remove));
exports.savedViewRoutes = router;
