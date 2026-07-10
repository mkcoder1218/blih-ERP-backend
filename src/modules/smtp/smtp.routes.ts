import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/role";
import { asyncHandler } from "../../utils/asyncHandler";
import { SmtpController } from "./smtp.controller";

const router = Router();
const controller = new SmtpController();

function platformOnly(req: any, _res: any, next: any) {
  if (req.user?.isPlatformSuperAdmin) return next();
  return next({ statusCode: 403, message: "Platform admin access required" });
}

router.get("/providers", authRequired, asyncHandler(controller.listProviders));
router.post("/providers", authRequired, platformOnly, asyncHandler(controller.createProvider));
router.patch("/providers/:id", authRequired, platformOnly, asyncHandler(controller.updateProvider));
router.delete("/providers/:id", authRequired, platformOnly, asyncHandler(controller.deleteProvider));

router.get("/business", authRequired, requireRole("BUSINESS_ADMIN"), asyncHandler(controller.getBusinessSetting));
router.put("/business", authRequired, requireRole("BUSINESS_ADMIN"), asyncHandler(controller.saveBusinessSetting));
router.post("/business/test", authRequired, requireRole("BUSINESS_ADMIN"), asyncHandler(controller.testBusinessSetting));
router.post("/business/punctuality-test-email", authRequired, requireRole("BUSINESS_ADMIN"), asyncHandler(controller.sendPunctualityTestEmail));

export const smtpRoutes = router;
