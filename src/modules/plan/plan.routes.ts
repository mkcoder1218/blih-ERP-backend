import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/role";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { createPlanSchema, updatePlanSchema } from "../../validators/plan.validator";
import { PlanController } from "./plan.controller";

const router = Router();
const controller = new PlanController();
router.use(authRequired);

router.get("/", requireRole("PLATFORM_SUPER_ADMIN"), asyncHandler(controller.list));
router.get("/catalog", requireRole("PLATFORM_SUPER_ADMIN"), asyncHandler(controller.catalog));
router.get("/:id", requireRole("PLATFORM_SUPER_ADMIN"), asyncHandler(controller.get));
router.post("/", requireRole("PLATFORM_SUPER_ADMIN"), validate(createPlanSchema), asyncHandler(controller.create));
router.patch("/:id", requireRole("PLATFORM_SUPER_ADMIN"), validate(updatePlanSchema), asyncHandler(controller.update));
router.delete("/:id", requireRole("PLATFORM_SUPER_ADMIN"), asyncHandler(controller.remove));

export const planRoutes = router;
