import { Router } from "express";
import { authRequired } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/role";
import { asyncHandler } from "../../utils/asyncHandler";
import { validate } from "../../middlewares/validate";
import { SubscriptionController, subscriptionAdminModels } from "./subscription.controller";
import { adminSchemas, changePlanSchema, invoiceSchema } from "../../validators/subscription.validator";

const router = Router();
const c = new SubscriptionController();
router.use(authRequired);
router.get(["/", "/current"], requireRole("PLATFORM_SUPER_ADMIN", "BUSINESS_ADMIN"), asyncHandler(c.current));
router.get("/features", requireRole("PLATFORM_SUPER_ADMIN", "BUSINESS_ADMIN"), asyncHandler(c.features));
router.get("/plans", requireRole("PLATFORM_SUPER_ADMIN", "BUSINESS_ADMIN"), asyncHandler(c.plans));
router.get("/usage", requireRole("PLATFORM_SUPER_ADMIN", "BUSINESS_ADMIN"), asyncHandler(c.usage));
router.get("/invoices", requireRole("PLATFORM_SUPER_ADMIN", "BUSINESS_ADMIN"), asyncHandler(c.invoices));
router.post("/change-plan", requireRole("BUSINESS_ADMIN"), validate(changePlanSchema), asyncHandler(c.changePlan));
router.post("/cancel", requireRole("BUSINESS_ADMIN"), asyncHandler(c.cancel));
router.post("/reactivate", requireRole("BUSINESS_ADMIN"), asyncHandler(c.reactivate));
router.post("/:subscriptionId/generate-invoice", requireRole("PLATFORM_SUPER_ADMIN"), validate(invoiceSchema), asyncHandler(c.generateInvoice));

for (const [path, model] of Object.entries(subscriptionAdminModels)) {
  router.get(`/admin/${path}`, requireRole("PLATFORM_SUPER_ADMIN"), asyncHandler(c.list(model)));
  router.post(`/admin/${path}`, requireRole("PLATFORM_SUPER_ADMIN"), validate(adminSchemas[path]), asyncHandler(c.create(model)));
  router.patch(`/admin/${path}/:id`, requireRole("PLATFORM_SUPER_ADMIN"), validate(adminSchemas[path].fork(Object.keys(adminSchemas[path].describe().keys), s => s.optional()).min(1)), asyncHandler(c.update(model)));
  router.delete(`/admin/${path}/:id`, requireRole("PLATFORM_SUPER_ADMIN"), asyncHandler(c.remove(model)));
}
export const subscriptionRoutes = router;
