import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireAnyPermission } from "../../middlewares/permission";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { createLateReasonSchema, updateLateReasonSchema } from "../../validators/attendanceLateReason.validator";
import { LateReasonsController } from "./lateReasons.controller";

const router = Router();
const controller = new LateReasonsController();

router.use(authRequired);

router.get("/", requireAnyPermission("attendance.late_reason.read", "attendance.self"), asyncHandler(controller.list));
router.post("/", requireAnyPermission("attendance.manage"), validate(createLateReasonSchema), asyncHandler(controller.create));
router.put("/:reasonId", requireAnyPermission("attendance.manage"), validate(updateLateReasonSchema), asyncHandler(controller.update));
router.delete("/:reasonId", requireAnyPermission("attendance.manage"), asyncHandler(controller.remove));

export const attendanceHrLateReasonsRoutes = router;
