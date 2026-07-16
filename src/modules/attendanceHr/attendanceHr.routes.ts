import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireAnyPermission } from "../../middlewares/permission";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { dailyQuerySchema, dailyReportExportQuerySchema, employeeDailyParamsSchema, employeeDailyQuerySchema, exportQuerySchema, monthlyReportExportQuerySchema, removeAutoAddedAttendanceSchema, reportQuerySchema, summaryQuerySchema, weeklyReportExportQuerySchema } from "../../validators/attendanceHr.validator";
import { AttendanceHrController } from "./attendanceHr.controller";

const router = Router();
const controller = new AttendanceHrController();

function attendanceHrAccess(req: any, _res: any, next: any) {
  if (!req.user) return next({ statusCode: 401, message: "Unauthorized" });
  if (req.user.isPlatformSuperAdmin) return next();
  const roles = new Set(req.user.roles || []);
  if (roles.has("BUSINESS_ADMIN") || roles.has("HR_MANAGER")) return next();
  return requireAnyPermission("attendance.manage", "attendance.read")(req, _res, next);
}

router.use(authRequired);
router.use(attendanceHrAccess);

router.get("/summary", validate(summaryQuerySchema, "query"), asyncHandler(controller.summary));
router.get("/lateness-credit-config", asyncHandler(controller.getLatenessCreditConfig));
router.patch("/lateness-credit-config", asyncHandler(controller.updateLatenessCreditConfig));
router.get("/lateness-reason-rules", asyncHandler(controller.listLatenessReasonRules));
router.post("/lateness-reason-rules", asyncHandler(controller.createLatenessReasonRule));
router.patch("/lateness-reason-rules/reorder", asyncHandler(controller.reorderLatenessReasonRules));
router.patch("/lateness-reason-rules/:idOrCode", asyncHandler(controller.updateLatenessReasonRule));
router.patch("/lateness-reason-rules/:idOrCode/enable", asyncHandler(controller.enableLatenessReasonRule));
router.patch("/lateness-reason-rules/:idOrCode/disable", asyncHandler(controller.disableLatenessReasonRule));
router.get("/daily", validate(dailyQuerySchema, "query"), asyncHandler(controller.daily));
router.get("/lateness-reason-usage", asyncHandler(controller.latenessReasonUsage));
router.get(
  "/employees/:employeeId",
  validate(employeeDailyParamsSchema, "params"),
  validate(employeeDailyQuerySchema, "query"),
  asyncHandler(controller.employee)
);
router.post(
  "/employees/:employeeId/late-no-reason-message",
  validate(employeeDailyParamsSchema, "params"),
  asyncHandler(controller.sendLateNoReasonPenaltyMessage)
);
router.post(
  "/employees/:employeeId/remove-auto-added-attendance",
  validate(employeeDailyParamsSchema, "params"),
  validate(removeAutoAddedAttendanceSchema),
  asyncHandler(controller.removeAutoAddedAttendance)
);

router.get("/report", validate(reportQuerySchema, "query"), asyncHandler(controller.report));
router.get("/export", validate(exportQuerySchema, "query"), asyncHandler(controller.export));
router.get("/reports/daily/export", validate(dailyReportExportQuerySchema, "query"), asyncHandler(controller.exportDailyReport));
router.get("/reports/weekly/export", validate(weeklyReportExportQuerySchema, "query"), asyncHandler(controller.exportWeeklyReport));
router.get("/reports/monthly/export", validate(monthlyReportExportQuerySchema, "query"), asyncHandler(controller.exportMonthlyReport));

export const attendanceHrRoutes = router;
