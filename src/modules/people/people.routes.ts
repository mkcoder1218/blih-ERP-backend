import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requirePermission } from "../../middlewares/permission";
import { validate } from "../../middlewares/validate";
import { asyncHandler } from "../../utils/asyncHandler";
import { createProfileTemplateSchema, updateProfileTemplateSchema } from "../../validators/profileTemplate.validator";
import { createProfileDraftSchema, updateProfileDraftSchema } from "../../validators/profileDraft.validator";
import { ProfileTemplateController } from "./profileTemplate.controller";
import { ProfileDraftController } from "./profileDraft.controller";

const router = Router();
const templateController = new ProfileTemplateController();
const draftController = new ProfileDraftController();

router.use(authRequired);

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

export const peopleRoutes = router;

