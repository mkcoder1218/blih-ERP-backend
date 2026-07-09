import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireAnyPermission } from "../../middlewares/permission";
import { requireRole } from "../../middlewares/role";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { createUserExemptionSchema, rejectUserExemptionSchema } from "../../validators/userExemption.validator";
import { UserExemptionsController } from "./userExemptions.controller";

const router = Router();
const controller = new UserExemptionsController();

router.use(authRequired);

router.get("/", requireAnyPermission("profiles.read", "hr.read", "hr.write", "user.read", "user.update"), asyncHandler(controller.list));
router.post("/", requireAnyPermission("hr.write", "user.update", "attendance.manage"), validate(createUserExemptionSchema), asyncHandler(controller.create));
router.post("/:id/approve", requireRole("BUSINESS_ADMIN"), asyncHandler(controller.approve));
router.post("/:id/reject", requireRole("BUSINESS_ADMIN"), validate(rejectUserExemptionSchema), asyncHandler(controller.reject));

export const userExemptionsRoutes = router;
