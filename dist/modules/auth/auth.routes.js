"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const validate_1 = require("../../middlewares/validate");
const asyncHandler_1 = require("../../utils/asyncHandler");
const auth_validator_1 = require("../../validators/auth.validator");
const auth_controller_1 = require("./auth.controller");
const auth_1 = require("../../middlewares/auth");
const security_1 = require("../../middlewares/security");
const profileImageUpload_1 = require("../../middlewares/profileImageUpload");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
const controller = new auth_controller_1.AuthController();
// Memory storage multer for public registration (no req.user context for disk paths)
const publicUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        cb(null, allowed.includes(file.mimetype));
    },
});
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
router.post("/register", profileImageUpload_1.uploadProfileImage.fields([{ name: "profileImage", maxCount: 1 }, { name: "documents", maxCount: 10 }]), (0, validate_1.validate)(auth_validator_1.registerSchema), (0, asyncHandler_1.asyncHandler)(controller.register));
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
// ── Public self-registration (no auth) ────────────────────────────────────────
router.get("/public-register/:businessSlug/config", security_1.publicRegisterLimiter, (0, asyncHandler_1.asyncHandler)(controller.getPublicRegistrationConfig));
// ── Public roles list for registration form ───────────────────────────────────
router.get("/public-register/:businessSlug/roles", security_1.publicRegisterLimiter, (0, asyncHandler_1.asyncHandler)(controller.publicListRoles));
// ── Public resubmit flow — fetch pre-fill data + resubmit ──────────────────
router.get("/public-register/:businessSlug/resubmit/:token", security_1.publicRegisterLimiter, (0, asyncHandler_1.asyncHandler)(controller.publicGetResubmitData));
router.post("/public-register/resubmit/:token", security_1.authRateLimiter, publicUpload.fields([
    { name: 'idDocumentFront', maxCount: 1 },
    { name: 'idDocumentBack', maxCount: 1 },
]), (0, asyncHandler_1.asyncHandler)(controller.publicResubmit));
// ── Public department + position lookup for registration form ─────────────────
router.get("/public-register/:businessSlug/departments", security_1.publicRegisterLimiter, (0, asyncHandler_1.asyncHandler)(controller.publicListDepartments));
router.get("/public-register/:businessSlug/positions", security_1.publicRegisterLimiter, (0, asyncHandler_1.asyncHandler)(controller.publicListPositions));
router.post("/public-register", security_1.authRateLimiter, publicUpload.fields([
    { name: 'idDocumentFront', maxCount: 1 },
    { name: 'idDocumentBack', maxCount: 1 },
]), (0, validate_1.validate)(auth_validator_1.publicRegisterSchema), (0, asyncHandler_1.asyncHandler)(controller.publicRegister));
exports.authRoutes = router;
