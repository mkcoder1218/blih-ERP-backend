import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { createAttendanceEventSchema, historyQuerySchema } from "../../validators/attendanceMe.validator";
import { AttendanceMeController } from "./attendanceMe.controller";

const router = Router();
const controller = new AttendanceMeController();

router.use(authRequired);

router.get("/me/today", asyncHandler(controller.today));
router.post("/me/events", validate(createAttendanceEventSchema), asyncHandler(controller.createEvent));
router.post("/me/events/revert-last", asyncHandler(controller.revertLastEvent));
router.get("/me/history", validate(historyQuerySchema, "query"), asyncHandler(controller.history));

export const attendanceMeRoutes = router;
