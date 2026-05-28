import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/role";
import { asyncHandler } from "../../utils/asyncHandler";
import { PermissionController } from "./permission.controller";

const router = Router();
const controller = new PermissionController();

router.use(authRequired);
router.use(requireRole("PLATFORM_SUPER_ADMIN", "BUSINESS_ADMIN"));

router.get("/", asyncHandler(controller.list));
router.post("/seed", asyncHandler(controller.seed));
router.post("/assign", asyncHandler(controller.assignToRole));

export const permissionRoutes = router;
