import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { PolicyController } from "./policy.controller";

const router = Router();
const controller = new PolicyController();

router.get("/guest/:policyType", asyncHandler(controller.getGuestPolicy));
router.get("/public", authRequired, asyncHandler(controller.listPublicPolicies));
router.post("/public/:id/accept", authRequired, asyncHandler(controller.acceptPolicy));

export const policyRoutes = router;
