"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.departmentRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const role_1 = require("../../middlewares/role");
const validate_1 = require("../../middlewares/validate");
const asyncHandler_1 = require("../../utils/asyncHandler");
const department_validator_1 = require("../../validators/department.validator");
const department_controller_1 = require("./department.controller");
const router = (0, express_1.Router)();
const controller = new department_controller_1.DepartmentController();
router.use(auth_1.authRequired);
// All employees can generally view the department layout
/**
 * @openapi
 * /api/departments:
 *   get:
 *     tags: [department]
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
 * /api/departments/{id}:
 *   get:
 *     tags: [department]
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
// Only business admins and up can create/update logic (or specific custom perms but we'll use BUSINESS_ADMIN here)
/**
 * @openapi
 * /api/departments:
 *   post:
 *     tags: [department]
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
router.post('/', (0, role_1.requireRole)('BUSINESS_ADMIN'), (0, validate_1.validate)(department_validator_1.createDepartmentSchema), (0, asyncHandler_1.asyncHandler)(controller.create));
/**
 * @openapi
 * /api/departments/{id}:
 *   patch:
 *     tags: [department]
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
router.patch('/:id', (0, role_1.requireRole)('BUSINESS_ADMIN'), (0, validate_1.validate)(department_validator_1.updateDepartmentSchema), (0, asyncHandler_1.asyncHandler)(controller.update));
/**
 * @openapi
 * /api/departments/{id}:
 *   delete:
 *     tags: [department]
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
exports.departmentRoutes = router;
