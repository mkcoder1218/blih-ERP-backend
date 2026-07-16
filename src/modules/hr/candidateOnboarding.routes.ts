import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireAnyPermission } from "../../middlewares/permission";
import { requireActiveModule } from "../../middlewares/requireActiveModule";
import { asyncHandler } from "../../utils/asyncHandler";
import { upload } from "../../middlewares/upload";
import { CandidateOnboardingController } from "./candidateOnboarding.controller";

const controller = new CandidateOnboardingController();

// ─── Authenticated routes (HR_MANAGER / BUSINESS_ADMIN) ───────────────────────
const authRouter = Router();
authRouter.use(requireActiveModule("hr"));

authRouter.post(
  "/initialize",
  authRequired,
  requireAnyPermission("hr.write"),
  asyncHandler(controller.initialize)
);

authRouter.get(
  "/",
  authRequired,
  requireAnyPermission("hr.read", "hr.write"),
  asyncHandler(controller.list)
);

// Must come before /:id
authRouter.get(
  "/available-policies",
  authRequired,
  requireAnyPermission("hr.read", "hr.write"),
  asyncHandler(controller.listAvailablePolicies)
);

// Must come before /:id
authRouter.get(
  "/analytics",
  authRequired,
  requireAnyPermission("hr.read", "hr.write"),
  asyncHandler(controller.analytics)
);

// Must come before /:id
authRouter.get(
  "/by-offer/:offerId",
  authRequired,
  requireAnyPermission("hr.read", "hr.write"),
  asyncHandler(controller.getByOfferId)
);

// NOTE: this must come before /:id to avoid "public" being treated as an id
authRouter.get(
  "/:id",
  authRequired,
  requireAnyPermission("hr.read", "hr.write"),
  asyncHandler(controller.getById)
);

export const candidateOnboardingRoutes = authRouter;

// ─── Public routes (no auth — candidate-facing) ───────────────────────────────
const publicRouter = Router();

publicRouter.get(
  "/:onboardingId/policies/:policyType",
  asyncHandler(controller.getPublicPolicy)
);

publicRouter.get(
  "/:onboardingId",
  asyncHandler(controller.getPublic)
);

publicRouter.patch(
  "/:onboardingId/section",
  asyncHandler(controller.saveSection)
);

publicRouter.patch(
  "/:onboardingId/resources",
  asyncHandler(controller.respondToResources)
);

publicRouter.post(
  "/:onboardingId/submit",
  asyncHandler(controller.submit)
);

publicRouter.post(
  "/:onboardingId/upload",
  upload.single("file"),
  asyncHandler(controller.uploadDocument)
);

export const publicCandidateOnboardingRoutes = publicRouter;
