import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { PolicyController } from "./policy.controller";

const router = Router();
const controller = new PolicyController();

// Unauthenticated public share resolution
router.get("/policies/share/:token", asyncHandler(controller.resolvePublicShareToken));

// Deprecated guest policy lookup (strictly platform-global policies where businessId IS NULL)
router.get("/guest/:policyType", asyncHandler(controller.getGuestPolicy));

export const policyPublicRoutes = router;
