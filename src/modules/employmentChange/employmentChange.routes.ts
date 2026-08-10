import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { EmploymentChangeController } from "./employmentChange.controller";

const router = Router();
const controller = new EmploymentChangeController();

router.use(authRequired);

router.get("/context", asyncHandler(controller.context));
router.get("/", asyncHandler(controller.list));
router.post("/", asyncHandler(controller.create));
router.get("/:id/history", asyncHandler(controller.history));
router.get("/:id", asyncHandler(controller.get));
router.post("/:id/approve", asyncHandler(controller.approve));
router.post("/:id/counter", asyncHandler(controller.counter));
router.post("/:id/reject", asyncHandler(controller.reject));
router.post("/:id/cancel", asyncHandler(controller.cancel));

export const employmentChangeRoutes = router;
