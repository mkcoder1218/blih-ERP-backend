import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/role";
import { requirePermission } from "../../middlewares/permission";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { dailyQuerySchema, employeeDailyParamsSchema, employeeDailyQuerySchema, exportQuerySchema, reportQuerySchema, summaryQuerySchema } from "../../validators/attendanceHr.validator";
import { AttendanceHrController } from "./attendanceHr.controller";

const router = Router();
const controller = new AttendanceHrController();

router.use(authRequired);
router.use(requireRole("HR_MANAGER", "BUSINESS_ADMIN"));
router.use(requirePermission("attendance.read"));

router.get("/summary", validate(summaryQuerySchema, "query"), asyncHandler(controller.summary));
router.get("/daily", validate(dailyQuerySchema, "query"), asyncHandler(controller.daily));
router.get(
  "/employees/:employeeId",
  validate(employeeDailyParamsSchema, "params"),
  validate(employeeDailyQuerySchema, "query"),
  asyncHandler(controller.employee)
);

router.get("/report", validate(reportQuerySchema, "query"), asyncHandler(controller.report));
router.get("/export", validate(exportQuerySchema, "query"), asyncHandler(controller.export));

export const attendanceHrRoutes = router;
