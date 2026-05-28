import { Router } from "express";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { registerSchema, loginSchema, selectWorkspaceSchema } from "../../validators/auth.validator";
import { AuthController } from "./auth.controller";
import { authRequired } from "../../middlewares/auth";
import { authRateLimiter } from "../../middlewares/security";

const router = Router();
const controller = new AuthController();

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
router.post("/register", validate(registerSchema), asyncHandler(controller.register));
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
router.post("/login", authRateLimiter, validate(loginSchema), asyncHandler(controller.login));
router.post("/select-workspace", authRateLimiter, validate(selectWorkspaceSchema), asyncHandler(controller.selectWorkspace));

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
router.get("/me", authRequired, asyncHandler(controller.me));

router.post("/refresh", asyncHandler(controller.refresh));
// router.post("/refresh", authRateLimiter, asyncHandler(controller.refresh));
router.post("/logout", authRequired, asyncHandler(controller.logout));

export const authRoutes = router;
