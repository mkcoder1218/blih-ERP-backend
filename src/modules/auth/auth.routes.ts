import { Router } from "express";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { registerSchema, loginSchema, selectWorkspaceSchema, publicRegisterSchema } from "../../validators/auth.validator";
import { AuthController } from "./auth.controller";
import { authRequired } from "../../middlewares/auth";
import { authRateLimiter } from "../../middlewares/security";
import { uploadProfileImage } from "../../middlewares/profileImageUpload";
import multer from "multer";

const router = Router();
const controller = new AuthController();

// Memory storage multer for public registration (no req.user context for disk paths)
const publicUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
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
router.post("/register", uploadProfileImage.fields([{ name: "profileImage", maxCount: 1 }, { name: "documents", maxCount: 10 }]), validate(registerSchema), asyncHandler(controller.register));
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
router.post("/login", validate(loginSchema), asyncHandler(controller.login));
router.post("/select-workspace", validate(selectWorkspaceSchema), asyncHandler(controller.selectWorkspace));

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

// ── Public self-registration (no auth) ────────────────────────────────────────
router.get(
  "/public-register/:businessSlug/config",
  authRateLimiter,
  asyncHandler(controller.getPublicRegistrationConfig),
);

// ── Public department + position lookup for registration form ─────────────────
router.get(
  "/public-register/:businessSlug/departments",
  asyncHandler(controller.publicListDepartments),
);
router.post(
  "/public-register/:businessSlug/departments",
  authRateLimiter,
  asyncHandler(controller.publicCreateDepartment),
);
router.get(
  "/public-register/:businessSlug/positions",
  asyncHandler(controller.publicListPositions),
);
router.post(
  "/public-register/:businessSlug/positions",
  authRateLimiter,
  asyncHandler(controller.publicCreatePosition),
);
router.post(
  "/public-register",
  authRateLimiter,
  publicUpload.single('idDocument'),
  validate(publicRegisterSchema),
  asyncHandler(controller.publicRegister),
);

export const authRoutes = router;
