"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const validate_1 = require("../../middlewares/validate");
const asyncHandler_1 = require("../../utils/asyncHandler");
const auth_validator_1 = require("../../validators/auth.validator");
const auth_controller_1 = require("./auth.controller");
const auth_1 = require("../../middlewares/auth");
const router = (0, express_1.Router)();
const controller = new auth_controller_1.AuthController();
/**
 * @openapi
 * /api/v1/auth/register:
 *   post:
 *     tags: [auth]
 *     summary: POST /register
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
router.post("/register", (0, validate_1.validate)(auth_validator_1.registerSchema), (0, asyncHandler_1.asyncHandler)(controller.register));
/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     tags: [auth]
 *     summary: POST /login
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
router.post("/login", (0, validate_1.validate)(auth_validator_1.loginSchema), (0, asyncHandler_1.asyncHandler)(controller.login));
router.post("/select-workspace", (0, validate_1.validate)(auth_validator_1.selectWorkspaceSchema), (0, asyncHandler_1.asyncHandler)(controller.selectWorkspace));
/**
 * @openapi
 * /api/v1/auth/me:
 *   get:
 *     tags: [auth]
 *     summary: GET /me
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.get("/me", auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(controller.me));
router.post("/refresh", (0, asyncHandler_1.asyncHandler)(controller.refresh));
// router.post("/refresh", authRateLimiter, asyncHandler(controller.refresh));
router.post("/logout", auth_1.authRequired, (0, asyncHandler_1.asyncHandler)(controller.logout));
exports.authRoutes = router;
