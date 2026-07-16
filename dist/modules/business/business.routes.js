"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.businessRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const role_1 = require("../../middlewares/role");
const permission_1 = require("../../middlewares/permission");
const validate_1 = require("../../middlewares/validate");
const asyncHandler_1 = require("../../utils/asyncHandler");
const business_validator_1 = require("../../validators/business.validator");
const attendanceSettings_validator_1 = require("../../validators/attendanceSettings.validator");
const business_controller_1 = require("./business.controller");
const businessAdmin_validator_1 = require("../../validators/businessAdmin.validator");
const businessAdmin_controller_1 = require("./businessAdmin.controller");
const attendanceSettings_controller_1 = require("../attendanceSettings/attendanceSettings.controller");
const attendanceTelegram_controller_1 = require("../attendanceTelegram/attendanceTelegram.controller");
const router = (0, express_1.Router)();
const controller = new business_controller_1.BusinessController();
const adminController = new businessAdmin_controller_1.BusinessAdminController();
const attendanceSettingsController = new attendanceSettings_controller_1.AttendanceSettingsController();
const attendanceTelegramController = new attendanceTelegram_controller_1.AttendanceTelegramController();
router.use(auth_1.authRequired);
function requireAttendanceSettingsAccess(req, _res, next) {
    if (!req.user)
        return next({ statusCode: 401, message: "Unauthorized" });
    if (req.user.isPlatformSuperAdmin)
        return next();
    const roles = new Set(req.user.roles || []);
    if (roles.has("BUSINESS_ADMIN") && req.user.businessId === req.params.businessId)
        return next();
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
router.get("/", (0, role_1.requireRole)("PLATFORM_SUPER_ADMIN"), (0, permission_1.requirePermission)("business.read"), (0, asyncHandler_1.asyncHandler)(controller.list));
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
router.get("/:id", (0, role_1.requireRole)("PLATFORM_SUPER_ADMIN"), (0, permission_1.requirePermission)("business.read"), (0, asyncHandler_1.asyncHandler)(controller.get));
router.post("/", (0, role_1.requireRole)("PLATFORM_SUPER_ADMIN"), (0, permission_1.requirePermission)("business.create"), (0, validate_1.validate)(business_validator_1.createBusinessSchema), (0, asyncHandler_1.asyncHandler)(controller.create));
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
router.post("/:businessId/admin", (0, role_1.requireRole)("PLATFORM_SUPER_ADMIN"), (0, permission_1.requirePermission)("user.create"), (0, validate_1.validate)(businessAdmin_validator_1.createBusinessAdminSchema), (0, asyncHandler_1.asyncHandler)(adminController.createBusinessAdmin));
router.patch("/:id", (0, role_1.requireRole)("PLATFORM_SUPER_ADMIN"), (0, permission_1.requirePermission)("business.update"), (0, validate_1.validate)(business_validator_1.updateBusinessSchema), (0, asyncHandler_1.asyncHandler)(controller.update));
router.get("/:businessId/attendance-settings", requireAttendanceSettingsAccess, (0, asyncHandler_1.asyncHandler)(attendanceSettingsController.get));
router.put("/:businessId/attendance-settings", requireAttendanceSettingsAccess, (0, validate_1.validate)(attendanceSettings_validator_1.upsertAttendanceSettingsSchema), (0, asyncHandler_1.asyncHandler)(attendanceSettingsController.upsert));
router.get("/:businessId/telegram-settings", (0, role_1.requireRole)("PLATFORM_SUPER_ADMIN"), (0, permission_1.requirePermission)("business.read"), (0, asyncHandler_1.asyncHandler)(attendanceTelegramController.settings));
router.put("/:businessId/telegram-settings/:botType", (0, role_1.requireRole)("PLATFORM_SUPER_ADMIN"), (0, permission_1.requirePermission)("business.update"), (0, asyncHandler_1.asyncHandler)(attendanceTelegramController.upsertSetting));
router.post("/:businessId/telegram-settings/:botType/test", (0, role_1.requireRole)("PLATFORM_SUPER_ADMIN"), (0, permission_1.requirePermission)("business.update"), (0, asyncHandler_1.asyncHandler)(attendanceTelegramController.sendTest));
router.delete("/:id", (0, role_1.requireRole)("PLATFORM_SUPER_ADMIN"), (0, permission_1.requirePermission)("business.delete"), (0, asyncHandler_1.asyncHandler)(controller.remove));
// Permanent purge — removes the business and ALL associated data irreversibly
router.delete("/:id/purge", (0, role_1.requireRole)("PLATFORM_SUPER_ADMIN"), (0, permission_1.requirePermission)("business.delete"), (0, asyncHandler_1.asyncHandler)(controller.purge));
exports.businessRoutes = router;
