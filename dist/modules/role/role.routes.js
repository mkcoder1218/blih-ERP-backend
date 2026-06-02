"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const role_1 = require("../../middlewares/role");
const permission_1 = require("../../middlewares/permission");
const validate_1 = require("../../middlewares/validate");
const asyncHandler_1 = require("../../utils/asyncHandler");
const role_validator_1 = require("../../validators/role.validator");
const role_controller_1 = require("./role.controller");
const router = (0, express_1.Router)();
const controller = new role_controller_1.RoleController();
router.use(auth_1.authRequired);
// Domain-scoped endpoint — any authenticated user with a domain role can call this
// Must be before /:id to avoid route collision
router.get("/my-domain", (0, permission_1.requirePermission)("role.read"), (0, asyncHandler_1.asyncHandler)(controller.listMyDomain));
router.get("/", (0, role_1.requireRole)("BUSINESS_ADMIN", "PLATFORM_SUPER_ADMIN"), (0, permission_1.requirePermission)("role.read"), (0, asyncHandler_1.asyncHandler)(controller.list));
/**
 * @openapi
 * /api/roles/{id}:
 *   get:
 *     tags: [role]
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
router.get("/:id", (0, role_1.requireRole)("BUSINESS_ADMIN"), (0, permission_1.requirePermission)("role.read"), (0, asyncHandler_1.asyncHandler)(controller.get));
/**
 * @openapi
 * /api/roles:
 *   post:
 *     tags: [role]
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
router.post("/", (0, role_1.requireRole)("BUSINESS_ADMIN"), (0, permission_1.requirePermission)("role.create"), (0, validate_1.validate)(role_validator_1.createRoleSchema), (0, asyncHandler_1.asyncHandler)(controller.create));
/**
 * @openapi
 * /api/roles/{id}:
 *   patch:
 *     tags: [role]
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
router.patch("/:id", (0, role_1.requireRole)("BUSINESS_ADMIN"), (0, permission_1.requirePermission)("role.update"), (0, validate_1.validate)(role_validator_1.updateRoleSchema), (0, asyncHandler_1.asyncHandler)(controller.update));
/**
 * @openapi
 * /api/roles/{id}:
 *   delete:
 *     tags: [role]
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
router.delete("/:id", (0, role_1.requireRole)("BUSINESS_ADMIN"), (0, permission_1.requirePermission)("role.delete"), (0, asyncHandler_1.asyncHandler)(controller.remove));
exports.roleRoutes = router;
