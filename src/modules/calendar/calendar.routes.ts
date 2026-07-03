import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireAnyPermission } from "../../middlewares/permission";
import { asyncHandler } from "../../utils/asyncHandler";
import { CalendarController } from "./calendar.controller";

const router = Router();
const ctrl = new CalendarController();

router.get("/google/callback", asyncHandler(ctrl.googleCallback));

router.use(authRequired);
router.use(requireAnyPermission("attendance.self", "attendance.read", "attendance.manage"));

router.get("/", asyncHandler(ctrl.list));
router.post("/", asyncHandler(ctrl.create));
router.get("/status", asyncHandler(ctrl.status));
router.get("/people", asyncHandler(ctrl.people));
router.get("/meeting-requests", asyncHandler(ctrl.meetingRequests));
router.post("/meeting-requests", asyncHandler(ctrl.createMeetingRequest));
router.patch("/meeting-requests/:id", asyncHandler(ctrl.respondMeetingRequest));
router.get("/google", asyncHandler(ctrl.googleConnection));
router.get("/google/auth-url", asyncHandler(ctrl.googleAuthUrl));
router.delete("/google", asyncHandler(ctrl.googleDisconnect));
router.post("/google/sync-from-google", asyncHandler(ctrl.syncFromGoogle));
router.post("/google-sync-all", asyncHandler(ctrl.syncAllGoogle));
router.post("/:id/google-sync", asyncHandler(ctrl.syncGoogle));
router.patch("/:id", asyncHandler(ctrl.update));
router.delete("/:id", asyncHandler(ctrl.remove));

export const calendarRoutes = router;
