import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/role";
import { requirePermission } from "../../middlewares/permission";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { createRoleSchema, duplicateRoleSchema, updateRoleSchema } from "../../validators/role.validator";
import { RoleController } from "./role.controller";

const router = Router();
const controller = new RoleController();
const adminRoles = ["BUSINESS_ADMIN", "PLATFORM_SUPER_ADMIN"] as const;

router.use(authRequired);

router.get("/my-domain", requirePermission("role.read"), asyncHandler(controller.listMyDomain));
router.get("/", requireRole(...adminRoles), requirePermission("role.read"), asyncHandler(controller.list));
router.post("/", requireRole(...adminRoles), requirePermission("role.create"), validate(createRoleSchema), asyncHandler(controller.create));

router.get("/:id/users", requireRole(...adminRoles), requirePermission("role.read"), asyncHandler(controller.users));
router.post("/:id/duplicate", requireRole(...adminRoles), requirePermission("role.create"), validate(duplicateRoleSchema), asyncHandler(controller.duplicate));
router.patch("/:id/archive", requireRole(...adminRoles), requirePermission("role.delete"), asyncHandler(controller.archive));
router.get("/:id", requireRole(...adminRoles), requirePermission("role.read"), asyncHandler(controller.get));
router.patch("/:id", requireRole(...adminRoles), requirePermission("role.update"), validate(updateRoleSchema), asyncHandler(controller.update));

// Backward-compatible alias. Delete is implemented as archive because Role is paranoid.
router.delete("/:id", requireRole(...adminRoles), requirePermission("role.delete"), asyncHandler(controller.remove));

export const roleRoutes = router;
