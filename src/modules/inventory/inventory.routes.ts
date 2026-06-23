import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireAnyPermission } from "../../middlewares/permission";
import { asyncHandler } from "../../utils/asyncHandler";
import { InventoryController } from "./inventory.controller";

const router = Router();
const controller = new InventoryController();

router.use(authRequired);
router.get("/", requireAnyPermission("hr.read", "hr.write"), asyncHandler(controller.list));
router.post("/", requireAnyPermission("hr.write"), asyncHandler(controller.create));
router.patch("/:id", requireAnyPermission("hr.write"), asyncHandler(controller.update));
router.delete("/:id", requireAnyPermission("hr.write"), asyncHandler(controller.remove));

export const inventoryRoutes = router;
