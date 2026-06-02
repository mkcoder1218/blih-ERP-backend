import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/role";
import { requirePermission } from "../../middlewares/permission";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { createLateReasonSchema, updateLateReasonSchema } from "../../validators/attendanceLateReason.validator";
import { LateReasonsController } from "./lateReasons.controller";

const router = Router();
const controller = new LateReasonsController();

router.use(authRequired);
router.use(requireRole("HR_MANAGER", "BUSINESS_ADMIN"));
router.use(requirePermission("attendance.read"));

router.get("/", asyncHandler(controller.list));
router.post("/", validate(createLateReasonSchema), asyncHandler(controller.create));
router.put("/:reasonId", validate(updateLateReasonSchema), asyncHandler(controller.update));
router.delete("/:reasonId", asyncHandler(controller.remove));

export const attendanceHrLateReasonsRoutes = router;

