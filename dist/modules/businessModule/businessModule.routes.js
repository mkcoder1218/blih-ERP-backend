"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.businessModuleRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const role_1 = require("../../middlewares/role");
const validate_1 = require("../../middlewares/validate");
const asyncHandler_1 = require("../../utils/asyncHandler");
const businessModule_validator_1 = require("../../validators/businessModule.validator");
const businessModule_controller_1 = require("./businessModule.controller");
const router = (0, express_1.Router)();
const controller = new businessModule_controller_1.BusinessModuleController();
router.use(auth_1.authRequired);
// Business admins can view enabled modules 
/**
 * @openapi
 * /api/business-modules:
 *   get:
 *     tags: [businessModule]
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
 * /api/business-modules/{id}:
 *   get:
 *     tags: [businessModule]
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
// Only Platform Admin can edit (enable/disable modules)
/**
 * @openapi
 * /api/business-modules/{id}:
 *   patch:
 *     tags: [businessModule]
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
router.patch('/:id', (0, role_1.requireRole)('PLATFORM_SUPER_ADMIN'), (0, validate_1.validate)(businessModule_validator_1.updateBusinessModuleSchema), (0, asyncHandler_1.asyncHandler)(controller.update));
exports.businessModuleRoutes = router;
