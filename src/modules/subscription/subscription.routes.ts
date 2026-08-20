import { Router } from "express";
import multer from "multer";
import { authRequired } from "../../middlewares/auth";
import { requireRole } from "../../middlewares/role";
import { asyncHandler } from "../../utils/asyncHandler";
import { validate } from "../../middlewares/validate";
import { SubscriptionController, subscriptionAdminModels } from "./subscription.controller";
import {
  adminSchemas,
  assignSubscriptionSchema,
  changePlanSchema,
  discountSchema,
  extendSchema,
  featureOverrideSchema,
  invoiceSchema,
  manualPaymentSchema,
  moduleOverrideSchema,
  policySchema,
  usageRecordSchema,
} from "../../validators/subscription.validator";

const router = Router();
const c = new SubscriptionController();
const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(file.mimetype)) return cb(new Error("Receipt must be PNG, JPG or PDF."));
    cb(null, true);
  },
});

router.use(authRequired);
router.get(["/", "/current"], requireRole("PLATFORM_SUPER_ADMIN", "BUSINESS_ADMIN"), asyncHandler(c.current));
router.get("/features", requireRole("PLATFORM_SUPER_ADMIN", "BUSINESS_ADMIN"), asyncHandler(c.features));
router.get("/plans", requireRole("PLATFORM_SUPER_ADMIN", "BUSINESS_ADMIN"), asyncHandler(c.plans));
router.get("/usage", requireRole("PLATFORM_SUPER_ADMIN", "BUSINESS_ADMIN"), asyncHandler(c.usage));
router.post("/usage/record", requireRole("PLATFORM_SUPER_ADMIN", "BUSINESS_ADMIN"), validate(usageRecordSchema), asyncHandler(c.recordUsage));
router.get("/invoices", requireRole("PLATFORM_SUPER_ADMIN", "BUSINESS_ADMIN"), asyncHandler(c.invoices));
router.get("/payments", requireRole("PLATFORM_SUPER_ADMIN", "BUSINESS_ADMIN"), asyncHandler(c.payments));
router.get("/invoices/:invoiceId/pdf", requireRole("PLATFORM_SUPER_ADMIN", "BUSINESS_ADMIN"), asyncHandler(c.invoicePdf));
router.get("/payments/:paymentId/pdf", requireRole("PLATFORM_SUPER_ADMIN", "BUSINESS_ADMIN"), asyncHandler(c.paymentPdf));
router.get("/payments/:paymentId/original-receipt", requireRole("PLATFORM_SUPER_ADMIN", "BUSINESS_ADMIN"), asyncHandler(c.originalReceipt));
router.post("/change-plan", requireRole("BUSINESS_ADMIN"), validate(changePlanSchema), asyncHandler(c.changePlan));
router.post("/cancel", requireRole("BUSINESS_ADMIN"), asyncHandler(c.cancel));
router.post("/reactivate", requireRole("BUSINESS_ADMIN"), asyncHandler(c.reactivate));
router.post("/:subscriptionId/generate-invoice", requireRole("PLATFORM_SUPER_ADMIN"), validate(invoiceSchema), asyncHandler(c.generateInvoice));

router.get("/admin/overview", requireRole("PLATFORM_SUPER_ADMIN"), asyncHandler(c.adminOverview));
router.get("/admin/businesses", requireRole("PLATFORM_SUPER_ADMIN"), asyncHandler(c.adminBusinesses));
router.get("/admin/businesses/:businessId", requireRole("PLATFORM_SUPER_ADMIN"), asyncHandler(c.adminBusinessDetail));
router.post("/admin/businesses/:businessId/assign", requireRole("PLATFORM_SUPER_ADMIN"), validate(assignSubscriptionSchema), asyncHandler(c.adminAssign));
router.post("/admin/businesses/:businessId/change-plan", requireRole("PLATFORM_SUPER_ADMIN"), validate(changePlanSchema), asyncHandler(c.adminChangePlan));
router.post("/admin/businesses/:businessId/payments", requireRole("PLATFORM_SUPER_ADMIN"), receiptUpload.single("receipt"), validate(manualPaymentSchema), asyncHandler(c.adminRecordPayment));
router.post("/admin/businesses/:businessId/extend", requireRole("PLATFORM_SUPER_ADMIN"), validate(extendSchema), asyncHandler(c.adminExtend));
router.post("/admin/businesses/:businessId/discount", requireRole("PLATFORM_SUPER_ADMIN"), validate(discountSchema), asyncHandler(c.adminDiscount));
router.post("/admin/businesses/:businessId/suspend", requireRole("PLATFORM_SUPER_ADMIN"), asyncHandler(c.adminSuspend));
router.post("/admin/businesses/:businessId/reactivate", requireRole("PLATFORM_SUPER_ADMIN"), asyncHandler(c.adminReactivate));
router.put("/admin/businesses/:businessId/policy", requireRole("PLATFORM_SUPER_ADMIN"), validate(policySchema), asyncHandler(c.adminBusinessPolicy));
router.get("/admin/platform-policy", requireRole("PLATFORM_SUPER_ADMIN"), asyncHandler(c.adminPlatformPolicy));
router.put("/admin/platform-policy", requireRole("PLATFORM_SUPER_ADMIN"), validate(policySchema), asyncHandler(c.adminUpdatePlatformPolicy));
router.put("/admin/businesses/:businessId/features/:featureId", requireRole("PLATFORM_SUPER_ADMIN"), validate(featureOverrideSchema), asyncHandler(c.adminFeatureOverride));
router.put("/admin/businesses/:businessId/modules/:moduleKey", requireRole("PLATFORM_SUPER_ADMIN"), validate(moduleOverrideSchema), asyncHandler(c.adminModuleOverride));

for (const [resource, model] of Object.entries(subscriptionAdminModels)) {
  const schema = adminSchemas[resource];
  if (!schema) continue;
  router.get(`/admin/raw/${resource}`, requireRole("PLATFORM_SUPER_ADMIN"), asyncHandler(c.list(model)));
  router.post(`/admin/raw/${resource}`, requireRole("PLATFORM_SUPER_ADMIN"), validate(schema), asyncHandler(c.create(model)));
  router.patch(`/admin/raw/${resource}/:id`, requireRole("PLATFORM_SUPER_ADMIN"), validate(schema.fork(Object.keys(schema.describe().keys), (s) => s.optional()).min(1)), asyncHandler(c.update(model)));
  router.delete(`/admin/raw/${resource}/:id`, requireRole("PLATFORM_SUPER_ADMIN"), asyncHandler(c.remove(model)));
}

export const subscriptionRoutes = router;
