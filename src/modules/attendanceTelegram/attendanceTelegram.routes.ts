import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/role";
import { requirePermission } from "../../middlewares/permission";
import { asyncHandler } from "../../utils/asyncHandler";
import { AttendanceTelegramController } from "./attendanceTelegram.controller";

const router = Router();
const controller = new AttendanceTelegramController();

router.post("/webhook/:businessId", asyncHandler(controller.webhook));

router.use(authRequired);
router.get("/me/status", asyncHandler(controller.myStatus));
router.post("/me/link-code", asyncHandler(controller.generateLinkCode));
router.post("/me/unlink", asyncHandler(controller.unlinkMe));
router.post("/business/:botType/test", requireRole("BUSINESS_ADMIN"), asyncHandler(controller.sendBusinessTest));
router.post("/business/group-message-test", requireRole("BUSINESS_ADMIN"), asyncHandler(controller.sendBusinessGroupMessageTest));
router.post("/businesses/:businessId/users/:userId/unlink", requireRole("PLATFORM_SUPER_ADMIN"), requirePermission("business.update"), asyncHandler(controller.adminUnlinkUser));

export const attendanceTelegramRoutes = router;
