"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.positionRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const role_1 = require("../../middlewares/role");
const validate_1 = require("../../middlewares/validate");
const asyncHandler_1 = require("../../utils/asyncHandler");
const position_validator_1 = require("../../validators/position.validator");
const position_controller_1 = require("./position.controller");
const router = (0, express_1.Router)();
const controller = new position_controller_1.PositionController();
router.use(auth_1.authRequired);
// All employees can view positions in the tenant
/**
 * @openapi
 * /api/positions:
 *   get:
 *     tags: [position]
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
router.get('/', (0, asyncHandler_1.asyncHandler)(controller.list));
/**
 * @openapi
 * /api/positions/{id}:
 *   get:
 *     tags: [position]
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
// Admin can mutate
/**
 * @openapi
 * /api/positions:
 *   post:
 *     tags: [position]
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
router.post('/', (0, role_1.requireRole)('BUSINESS_ADMIN'), (0, validate_1.validate)(position_validator_1.createPositionSchema), (0, asyncHandler_1.asyncHandler)(controller.create));
/**
 * @openapi
 * /api/positions/{id}:
 *   patch:
 *     tags: [position]
 *     summary: PATCH /:id
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
router.patch('/:id', (0, role_1.requireRole)('BUSINESS_ADMIN'), (0, validate_1.validate)(position_validator_1.updatePositionSchema), (0, asyncHandler_1.asyncHandler)(controller.update));
/**
 * @openapi
 * /api/positions/{id}:
 *   delete:
 *     tags: [position]
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
router.delete('/:id', (0, role_1.requireRole)('BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.remove));
exports.positionRoutes = router;
