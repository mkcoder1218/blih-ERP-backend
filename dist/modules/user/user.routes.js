"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const permission_1 = require("../../middlewares/permission");
const validate_1 = require("../../middlewares/validate");
const asyncHandler_1 = require("../../utils/asyncHandler");
const user_validator_1 = require("../../validators/user.validator");
const user_controller_1 = require("./user.controller");
const router = (0, express_1.Router)();
const controller = new user_controller_1.UserController();
router.use(auth_1.authRequired);
/**
 * @openapi
 * /api/v1/users:
 *   get:
 *     tags: [users]
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
router.get("/", (0, permission_1.requirePermission)("user.read"), (0, asyncHandler_1.asyncHandler)(controller.list));
/**
 * @openapi
 * /api/v1/users/{id}:
 *   get:
 *     tags: [users]
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
router.get("/:id", (0, permission_1.requirePermission)("user.read"), (0, asyncHandler_1.asyncHandler)(controller.get));
/**
 * @openapi
 * /api/v1/users:
 *   post:
 *     tags: [users]
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
router.post("/", (0, permission_1.requirePermission)("user.create"), (0, validate_1.validate)(user_validator_1.createUserSchema), (0, asyncHandler_1.asyncHandler)(controller.create));
/**
 * @openapi
 * /api/v1/users/{id}:
 *   patch:
 *     tags: [users]
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
router.patch("/:id", (0, permission_1.requirePermission)("user.update"), (0, validate_1.validate)(user_validator_1.updateUserSchema), (0, asyncHandler_1.asyncHandler)(controller.update));
/**
 * @openapi
 * /api/v1/users/{id}:
 *   delete:
 *     tags: [users]
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
router.delete("/:id", (0, permission_1.requirePermission)("user.delete"), (0, asyncHandler_1.asyncHandler)(controller.remove));
exports.userRoutes = router;
