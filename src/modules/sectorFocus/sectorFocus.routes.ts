import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/role";
import { requirePermission } from "../../middlewares/permission";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { createSectorFocusSchema, updateSectorFocusSchema } from "../../validators/sectorFocus.validator";
import { SectorFocusController } from "./sectorFocus.controller";

const router = Router();
const controller = new SectorFocusController();

router.use(authRequired);

router.get("/", requireRole("PLATFORM_SUPER_ADMIN"), requirePermission("business.read"), asyncHandler(controller.list));
router.get("/:id", requireRole("PLATFORM_SUPER_ADMIN"), requirePermission("business.read"), asyncHandler(controller.get));
router.post(
  "/",
  requireRole("PLATFORM_SUPER_ADMIN"),
  requirePermission("business.create"),
  validate(createSectorFocusSchema),
  asyncHandler(controller.create)
);
router.patch(
  "/:id",
  requireRole("PLATFORM_SUPER_ADMIN"),
  requirePermission("business.update"),
  validate(updateSectorFocusSchema),
  asyncHandler(controller.update)
);
router.delete(
  "/:id",
  requireRole("PLATFORM_SUPER_ADMIN"),
  requirePermission("business.delete"),
  asyncHandler(controller.remove)
);

export const sectorFocusRoutes = router;

