import { Router, type NextFunction, type Request, type Response } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireAnyPermission } from "../../middlewares/permission";
import { asyncHandler } from "../../utils/asyncHandler";
import { LeaveController } from "./leave.controller";

const router = Router();
const ctrl = new LeaveController();

const leaveApproverRoles = new Set(["HR_MANAGER", "BUSINESS_ADMIN", "DEPARTMENT_HEAD", "DEPT_HEAD"]);

function allowLeaveApprovalAccess(...permissionKeys: string[]) {
  const permissionGuard = requireAnyPermission(...permissionKeys);
  return (req: Request, res: Response, next: NextFunction) => {
    const roles = (req.user?.roles || []).map((role: string) => role.toUpperCase());
    if (roles.some((role) => leaveApproverRoles.has(role))) return next();
    return permissionGuard(req, res, next);
  };
}

router.use(authRequired);

// ── Templates (HR/Admin only) ─────────────────────────────────────────────
router.get(   "/templates",         asyncHandler(ctrl.listTemplates));
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
router.get(   "/pending",           allowLeaveApprovalAccess("leave.approve", "self_department_leave_read", "self_department_leave_manage"), asyncHandler(ctrl.listPending));

// ── HR / Admin: full view ─────────────────────────────────────────────────
router.get(   "/",                  allowLeaveApprovalAccess("leave.read", "leave.approve", "self_department_leave_read", "self_department_leave_manage"), asyncHandler(ctrl.listAll));
router.get(   "/:id",               asyncHandler(ctrl.get));
router.post(  "/:id/approve",       allowLeaveApprovalAccess("leave.approve", "self_department_leave_manage"), asyncHandler(ctrl.approve));
router.post(  "/:id/reject",        allowLeaveApprovalAccess("leave.approve", "self_department_leave_manage"), asyncHandler(ctrl.reject));

export const leaveRoutes = router;
