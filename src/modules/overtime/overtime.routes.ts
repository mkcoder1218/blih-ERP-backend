import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { OvertimeController } from "./overtime.controller";

const router = Router();
const ctrl = new OvertimeController();

router.use(authRequired);

// Employee routes
router.get("/mine",        asyncHandler(ctrl.listMine));
router.post("/",           asyncHandler(ctrl.submit));
router.patch("/:id/cancel", asyncHandler(ctrl.cancel));

// Approver inbox — returns only requests at the caller's stage
router.get("/pending",     asyncHandler(ctrl.listPending));
router.get("/active",      asyncHandler(ctrl.listActive));
router.get("/closed",      asyncHandler(ctrl.listClosed));

// HR / Admin: full list
router.get("/",            asyncHandler(ctrl.listAll));
router.get("/:id",         asyncHandler(ctrl.get));

// Approval actions
router.post("/:id/approve", asyncHandler(ctrl.approve));
router.post("/:id/reject",  asyncHandler(ctrl.reject));
router.post("/:id/close",   asyncHandler(ctrl.close));

export const overtimeRoutes = router;
