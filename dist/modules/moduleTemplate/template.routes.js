"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.moduleTemplateRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const role_1 = require("../../middlewares/role");
const validate_1 = require("../../middlewares/validate");
const asyncHandler_1 = require("../../utils/asyncHandler");
const template_validator_1 = require("../../validators/template.validator");
const template_controller_1 = require("./template.controller");
const router = (0, express_1.Router)();
const controller = new template_controller_1.TemplateController();
router.use(auth_1.authRequired);
/**
 * @openapi
 * /api/module-templates:
 *   get:
 *     tags: [moduleTemplate]
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
 * /api/module-templates/apply:
 *   post:
 *     tags: [moduleTemplate]
 *     summary: POST /apply
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
router.post('/apply', (0, role_1.requireRole)('BUSINESS_ADMIN'), (0, validate_1.validate)(template_validator_1.applyTemplateSchema), (0, asyncHandler_1.asyncHandler)(controller.apply));
/**
 * @openapi
 * /api/module-templates/reapply:
 *   post:
 *     tags: [moduleTemplate]
 *     summary: POST /reapply
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
router.post('/reapply', (0, role_1.requireRole)('BUSINESS_ADMIN'), (0, validate_1.validate)(template_validator_1.applyTemplateSchema), (0, asyncHandler_1.asyncHandler)(controller.reapply));
exports.moduleTemplateRoutes = router;
