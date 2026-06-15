import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireAnyPermission } from "../../middlewares/permission";
import { requireRole } from "../../middlewares/role";
import { asyncHandler } from "../../utils/asyncHandler";
import { AttendanceRequestsController } from "./attendanceRequests.controller";

const router = Router();
const ctrl = new AttendanceRequestsController();

router.use(authRequired);

router.get("/mine", asyncHandler(ctrl.listMine));
router.post("/", requireAnyPermission("attendance.self", "attendance.checkin_correction.request", "attendance.manage"), asyncHandler(ctrl.submit));

router.get("/", requireRole("HR_MANAGER", "BUSINESS_ADMIN"), requireAnyPermission("attendance.read", "attendance.checkin_correction.approve"), asyncHandler(ctrl.listAll));
router.post("/sync-approved-corrections", requireAnyPermission("attendance.manage", "attendance.checkin_correction.approve"), asyncHandler(ctrl.syncApprovedCorrections));
router.post("/:id/approve", requireRole("BUSINESS_ADMIN"), asyncHandler(ctrl.approve));
router.post("/:id/reject", requireRole("BUSINESS_ADMIN"), asyncHandler(ctrl.reject));

export const attendanceRequestsRoutes = router;
