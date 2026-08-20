import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { TesterController } from "./tester.controller";
import { PlatformMasterTesterController } from "./tester.platform.controller";

const router = Router();
const controller = new TesterController();
const platformController = new PlatformMasterTesterController();

router.use(authRequired);

// Deliberately available to every authenticated user so the frontend can
// determine whether the Tester UI should be shown. Non-test users receive
// isTestAccount=false and no tester data.
router.get("/session", asyncHandler(controller.session));

// Platform Super Admin-only Master Tester management. Authorization is
// enforced inside PlatformMasterTesterService against the persisted admin
// identity, so Master Tester effective-super-admin authority cannot use it.
router.get("/platform/options", asyncHandler(platformController.options));
router.get("/platform/masters", asyncHandler(platformController.list));
router.post("/platform/masters", asyncHandler(platformController.create));

// From here down, TesterService enforces tester/master authority.
router.get("/", asyncHandler(controller.list));
router.get("/options", asyncHandler(controller.options));
router.post("/", asyncHandler(controller.create));
router.patch("/:userId", asyncHandler(controller.update));
router.post("/:userId/reset-password", asyncHandler(controller.resetPassword));

export const testerRoutes = router;
