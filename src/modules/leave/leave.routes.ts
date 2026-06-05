import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireAnyPermission } from "../../middlewares/permission";
import { asyncHandler } from "../../utils/asyncHandler";
import { LeaveController } from "./leave.controller";

const router = Router();
const ctrl = new LeaveController();

router.use(authRequired);

// ── Templates (HR/Admin only) ─────────────────────────────────────────────
router.get(   "/templates",         requireAnyPermission("leave.read", "leave.approve"), asyncHandler(ctrl.listTemplates));
router.post(  "/templates",         requireAnyPermission("leave.approve"),               asyncHandler(ctrl.createTemplate));
router.patch( "/templates/:id",     requireAnyPermission("leave.approve"),               asyncHandler(ctrl.updateTemplate));
router.patch( "/templates/:id/toggle", requireAnyPermission("leave.approve"),            asyncHandler(ctrl.toggleTemplate));
router.delete("/templates/:id",     requireAnyPermission("leave.approve"),               asyncHandler(ctrl.deleteTemplate));

// ── Employee routes ───────────────────────────────────────────────────────
router.get(   "/mine",              asyncHandler(ctrl.listMine));
router.post(  "/",                  asyncHandler(ctrl.submit));
router.patch( "/:id/cancel",        asyncHandler(ctrl.cancel));
router.get(   "/my-balances",       asyncHandler(ctrl.getMyBalances));

// ── Approver inbox ────────────────────────────────────────────────────────
router.get(   "/pending",           asyncHandler(ctrl.listPending));

// ── HR / Admin: full view ─────────────────────────────────────────────────
router.get(   "/",                  requireAnyPermission("leave.read", "leave.approve"), asyncHandler(ctrl.listAll));
router.get(   "/:id",               asyncHandler(ctrl.get));
router.post(  "/:id/approve",       asyncHandler(ctrl.approve));
router.post(  "/:id/reject",        asyncHandler(ctrl.reject));

export const leaveRoutes = router;
