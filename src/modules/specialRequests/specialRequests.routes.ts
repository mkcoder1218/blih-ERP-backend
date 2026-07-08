import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/role";
import { validate } from "../../middlewares/validate";
import { specialRequestCreateSchema, specialRequestListSchema, specialRequestRejectSchema } from "../../validators/specialRequest.validator";
import { asyncHandler } from "../../utils/asyncHandler";
import { SpecialRequestsController } from "./specialRequests.controller";

const router = Router();
const ctrl = new SpecialRequestsController();

router.use(authRequired);

router.get("/mine", validate(specialRequestListSchema, "query"), asyncHandler(ctrl.listMine));
router.post("/", validate(specialRequestCreateSchema, "body"), asyncHandler(ctrl.submit));

router.get("/", requireRole("HR_MANAGER", "BUSINESS_ADMIN"), validate(specialRequestListSchema, "query"), asyncHandler(ctrl.listAll));
router.post("/:id/approve", requireRole("HR_MANAGER", "BUSINESS_ADMIN"), asyncHandler(ctrl.approve));
router.post("/:id/reject", requireRole("HR_MANAGER", "BUSINESS_ADMIN"), validate(specialRequestRejectSchema, "body"), asyncHandler(ctrl.reject));

export const specialRequestsRoutes = router;
