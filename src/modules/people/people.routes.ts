import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requirePermission } from "../../middlewares/permission";
import { requireAnyPermission } from "../../middlewares/permission";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { createProfileTemplateSchema, updateProfileTemplateSchema } from "../../validators/profileTemplate.validator";
import { createProfileDraftSchema, updateProfileDraftSchema } from "../../validators/profileDraft.validator";
import { ProfileTemplateController } from "./profileTemplate.controller";
import { ProfileDraftController } from "./profileDraft.controller";
import { HREventController } from "./hrEvent.controller";
import { employmentChangeRoutes } from "../employmentChange/employmentChange.routes";
import { testerRoutes } from "../tester/tester.routes";

const router = Router();
const templateController = new ProfileTemplateController();
const draftController    = new ProfileDraftController();
const eventController    = new HREventController();

router.use(authRequired);

router.use("/employment-changes", employmentChangeRoutes);
router.use("/tester-control", testerRoutes);

router.get("/profile-templates", requirePermission("user.read"), asyncHandler(templateController.list));
router.post("/profile-templates", requirePermission("user.create"), validate(createProfileTemplateSchema), asyncHandler(templateController.create));
router.get("/profile-templates/:id", requirePermission("user.read"), asyncHandler(templateController.get));
router.patch("/profile-templates/:id", requirePermission("user.update"), validate(updateProfileTemplateSchema), asyncHandler(templateController.update));
router.delete("/profile-templates/:id", requirePermission("user.delete"), asyncHandler(templateController.remove));

router.get("/profile-drafts", requirePermission("user.read"), asyncHandler(draftController.list));
router.post("/profile-drafts", requirePermission("user.create"), validate(createProfileDraftSchema), asyncHandler(draftController.create));
router.get("/profile-drafts/:id", requirePermission("user.read"), asyncHandler(draftController.get));
router.patch("/profile-drafts/:id", requirePermission("user.update"), validate(updateProfileDraftSchema), asyncHandler(draftController.update));
router.delete("/profile-drafts/:id", requirePermission("user.delete"), asyncHandler(draftController.remove));

// ── HR Events (Calendar) ──────────────────────────────────────────────────────
// Any authenticated user sees events they're eligible for
router.get(
  "/events",
  requireAnyPermission("profiles.read", "hr.read", "hr.write", "profiles.self"),
  asyncHandler(eventController.list),
);
// Create / Update / Delete — HR only
router.post(
  "/events",
  requireAnyPermission("hr.read", "hr.write"),
  asyncHandler(eventController.create),
);
router.patch(
  "/events/:id",
  requireAnyPermission("hr.read", "hr.write"),
  asyncHandler(eventController.update),
);
router.delete(
  "/events/:id",
  requireAnyPermission("hr.write"),
  asyncHandler(eventController.remove),
);
// ── Public Holiday Import (Calendarific) — HR / Admin only ───────────────────
router.get(
  "/events/holiday-config",
  requireAnyPermission("hr.read", "hr.write", "settings.read", "settings.update"),
  asyncHandler(eventController.getHolidayConfig),
);
router.post(
  "/events/holiday-config",
  requireAnyPermission("hr.write", "settings.update"),
  asyncHandler(eventController.saveHolidayConfig),
);
router.post(
  "/events/import-holidays",
  requireAnyPermission("hr.write", "settings.update"),
  asyncHandler(eventController.importHolidays),
);

export const peopleRoutes = router;

