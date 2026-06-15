import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireAnyPermission } from "../../middlewares/permission";
import { asyncHandler } from "../../utils/asyncHandler";
import { DevicesController } from "./devices.controller";

const router = Router();
const controller = new DevicesController();

router.use(authRequired);

router.get("/me", asyncHandler(controller.listMine));
router.post("/me/seen", asyncHandler(controller.seenMine));
router.post("/me/register", asyncHandler(controller.registerMine));

router.get("/", requireAnyPermission("device.read", "device.approve"), asyncHandler(controller.listAll));
router.post("/:id/approve", requireAnyPermission("device.approve"), asyncHandler(controller.approve));
router.post("/:id/reject", requireAnyPermission("device.approve"), asyncHandler(controller.reject));

export const devicesRoutes = router;
