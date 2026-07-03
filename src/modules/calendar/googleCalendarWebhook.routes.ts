import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { GoogleCalendarSyncService } from "./googleCalendarSync.service";

const router = Router();
const googleSync = new GoogleCalendarSyncService();

router.post(
  "/webhook",
  asyncHandler(async (req, res) => {
    await googleSync.handleGoogleWebhook(req.headers, req.body);
    res.status(204).send();
  })
);

export const googleCalendarWebhookRoutes = router;
