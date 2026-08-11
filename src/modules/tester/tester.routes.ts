import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { TesterController } from "./tester.controller";

const router = Router();
const controller = new TesterController();

router.use(authRequired);

// Deliberately available to every authenticated user so the frontend can
// determine whether the Tester UI should be shown. Non-test users receive
// isTestAccount=false and no tester data.
router.get("/session", asyncHandler(controller.session));

// From here down, TesterService enforces tester/master authority.
router.get("/", asyncHandler(controller.list));
router.get("/options", asyncHandler(controller.options));
router.post("/", asyncHandler(controller.create));
router.patch("/:userId", asyncHandler(controller.update));
router.post("/:userId/reset-password", asyncHandler(controller.resetPassword));

export const testerRoutes = router;
