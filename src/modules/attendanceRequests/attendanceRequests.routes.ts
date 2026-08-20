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

router.get("/", requireRole("HR_MANAGER", "BUSINESS_ADMIN"), requireAnyPermission("attendance.read", "attendance.manage", "attendance.checkin_correction.approve"), asyncHandler(ctrl.listAll));
router.post(
  "/fix-manual-times",
  requireAnyPermission("attendance.read", "attendance.manage", "attendance.checkin_correction.request", "attendance.checkin_correction.approve"),
  asyncHandler(ctrl.fixManualTimes)
);
router.get("/lateness-notices/pending", requireRole("HR_MANAGER", "BUSINESS_ADMIN"), requireAnyPermission("attendance.read", "attendance.manage", "attendance.checkin_correction.approve"), asyncHandler(ctrl.listPendingLatenessNotices));
router.post("/lateness-notices/:id/approve", requireRole("HR_MANAGER", "BUSINESS_ADMIN"), asyncHandler(ctrl.approveLatenessNotice));
router.post("/lateness-notices/:id/reject", requireRole("HR_MANAGER", "BUSINESS_ADMIN"), asyncHandler(ctrl.rejectLatenessNotice));
router.post("/lateness-notices/:id/invalid", requireRole("HR_MANAGER", "BUSINESS_ADMIN"), asyncHandler(ctrl.markInvalidLatenessNotice));
router.post("/:id/approve", requireRole("HR_MANAGER", "BUSINESS_ADMIN"), asyncHandler(ctrl.approve));
router.post("/:id/reject", requireRole("HR_MANAGER", "BUSINESS_ADMIN"), asyncHandler(ctrl.reject));
router.post(
  "/:id/cancel",
  requireAnyPermission(
    "attendance.self",
    "attendance.manage"
  ),
  asyncHandler(ctrl.cancelWorkFromHome)
)
export const attendanceRequestsRoutes = router;
