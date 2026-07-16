import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/role";
import { requirePermission } from "../../middlewares/permission";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { createBusinessSchema, updateBusinessSchema } from "../../validators/business.validator";
import { upsertAttendanceSettingsSchema } from "../../validators/attendanceSettings.validator";
import { BusinessController } from "./business.controller";
import { createBusinessAdminSchema } from "../../validators/businessAdmin.validator";
import { BusinessAdminController } from "./businessAdmin.controller";
import { AttendanceSettingsController } from "../attendanceSettings/attendanceSettings.controller";
import { AttendanceTelegramController } from "../attendanceTelegram/attendanceTelegram.controller";

const router = Router();
const controller = new BusinessController();
const adminController = new BusinessAdminController();
const attendanceSettingsController = new AttendanceSettingsController();
const attendanceTelegramController = new AttendanceTelegramController();

router.use(authRequired);

function requireAttendanceSettingsAccess(req: any, _res: any, next: any) {
  if (!req.user) return next({ statusCode: 401, message: "Unauthorized" });
  if (req.user.isPlatformSuperAdmin) return next();

  const roles = new Set(req.user.roles || []);
  if (roles.has("BUSINESS_ADMIN") && req.user.businessId === req.params.businessId) return next();

  return next({ statusCode: 403, message: "Forbidden (role)" });
}

/**
 * @openapi
 * /api/v1/business:
 *   get:
 *     tags: [business]
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
router.get("/", requireRole("PLATFORM_SUPER_ADMIN"), requirePermission("business.read"), asyncHandler(controller.list));
/**
 * @openapi
 * /api/v1/business/{id}:
 *   get:
 *     tags: [business]
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
router.get("/:id", requireRole("PLATFORM_SUPER_ADMIN"), requirePermission("business.read"), asyncHandler(controller.get));
router.post(
  "/",
  requireRole("PLATFORM_SUPER_ADMIN"),
  requirePermission("business.create"),
  validate(createBusinessSchema),
  asyncHandler(controller.create)
);

/**
 * @openapi
 * /api/v1/businesses/{businessId}/admin:
 *   post:
 *     tags: [business]
 *     summary: Create first Business Admin for a business
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
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
router.post(
  "/:businessId/admin",
  requireRole("PLATFORM_SUPER_ADMIN"),
  requirePermission("user.create"),
  validate(createBusinessAdminSchema),
  asyncHandler(adminController.createBusinessAdmin)
);
router.patch(
  "/:id",
  requireRole("PLATFORM_SUPER_ADMIN"),
  requirePermission("business.update"),
  validate(updateBusinessSchema),
  asyncHandler(controller.update)
);

router.get(
  "/:businessId/attendance-settings",
  requireAttendanceSettingsAccess,
  asyncHandler(attendanceSettingsController.get)
);

router.put(
  "/:businessId/attendance-settings",
  requireAttendanceSettingsAccess,
  validate(upsertAttendanceSettingsSchema),
  asyncHandler(attendanceSettingsController.upsert)
);

router.get(
  "/:businessId/telegram-settings",
  requireRole("PLATFORM_SUPER_ADMIN"),
  requirePermission("business.read"),
  asyncHandler(attendanceTelegramController.settings)
);

router.put(
  "/:businessId/telegram-settings/:botType",
  requireRole("PLATFORM_SUPER_ADMIN"),
  requirePermission("business.update"),
  asyncHandler(attendanceTelegramController.upsertSetting)
);

router.post(
  "/:businessId/telegram-settings/:botType/test",
  requireRole("PLATFORM_SUPER_ADMIN"),
  requirePermission("business.update"),
  asyncHandler(attendanceTelegramController.sendTest)
);
router.delete(
  "/:id",
  requireRole("PLATFORM_SUPER_ADMIN"),
  requirePermission("business.delete"),
  asyncHandler(controller.remove)
);

// Permanent purge — removes the business and ALL associated data irreversibly
router.delete(
  "/:id/purge",
  requireRole("PLATFORM_SUPER_ADMIN"),
  requirePermission("business.delete"),
  asyncHandler(controller.purge)
);

export const businessRoutes = router;
