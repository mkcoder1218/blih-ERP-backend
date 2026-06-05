import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requirePermission } from "../../middlewares/permission";
import { requireRole } from "../../middlewares/role";
import { asyncHandler } from "../../utils/asyncHandler";
import { AttendanceRequestsController } from "./attendanceRequests.controller";

const router = Router();
const ctrl = new AttendanceRequestsController();

router.use(authRequired);

router.get("/mine", asyncHandler(ctrl.listMine));
router.post("/", asyncHandler(ctrl.submit));

router.get("/", requireRole("HR_MANAGER", "BUSINESS_ADMIN"), requirePermission("attendance.read"), asyncHandler(ctrl.listAll));
router.post("/:id/approve", requireRole("HR_MANAGER", "BUSINESS_ADMIN"), requirePermission("attendance.write"), asyncHandler(ctrl.approve));
router.post("/:id/reject", requireRole("HR_MANAGER", "BUSINESS_ADMIN"), requirePermission("attendance.write"), asyncHandler(ctrl.reject));

export const attendanceRequestsRoutes = router;
