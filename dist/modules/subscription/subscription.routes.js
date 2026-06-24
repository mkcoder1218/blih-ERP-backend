"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const role_1 = require("../../middlewares/role");
const asyncHandler_1 = require("../../utils/asyncHandler");
const validate_1 = require("../../middlewares/validate");
const subscription_controller_1 = require("./subscription.controller");
const subscription_validator_1 = require("../../validators/subscription.validator");
const router = (0, express_1.Router)();
const c = new subscription_controller_1.SubscriptionController();
router.use(auth_1.authRequired);
router.get(["/", "/current"], (0, role_1.requireRole)("PLATFORM_SUPER_ADMIN", "BUSINESS_ADMIN"), (0, asyncHandler_1.asyncHandler)(c.current));
router.get("/features", (0, role_1.requireRole)("PLATFORM_SUPER_ADMIN", "BUSINESS_ADMIN"), (0, asyncHandler_1.asyncHandler)(c.features));
router.get("/plans", (0, role_1.requireRole)("PLATFORM_SUPER_ADMIN", "BUSINESS_ADMIN"), (0, asyncHandler_1.asyncHandler)(c.plans));
router.get("/usage", (0, role_1.requireRole)("PLATFORM_SUPER_ADMIN", "BUSINESS_ADMIN"), (0, asyncHandler_1.asyncHandler)(c.usage));
router.get("/invoices", (0, role_1.requireRole)("PLATFORM_SUPER_ADMIN", "BUSINESS_ADMIN"), (0, asyncHandler_1.asyncHandler)(c.invoices));
router.post("/change-plan", (0, role_1.requireRole)("BUSINESS_ADMIN"), (0, validate_1.validate)(subscription_validator_1.changePlanSchema), (0, asyncHandler_1.asyncHandler)(c.changePlan));
router.post("/cancel", (0, role_1.requireRole)("BUSINESS_ADMIN"), (0, asyncHandler_1.asyncHandler)(c.cancel));
router.post("/reactivate", (0, role_1.requireRole)("BUSINESS_ADMIN"), (0, asyncHandler_1.asyncHandler)(c.reactivate));
router.post("/:subscriptionId/generate-invoice", (0, role_1.requireRole)("PLATFORM_SUPER_ADMIN"), (0, validate_1.validate)(subscription_validator_1.invoiceSchema), (0, asyncHandler_1.asyncHandler)(c.generateInvoice));
for (const [path, model] of Object.entries(subscription_controller_1.subscriptionAdminModels)) {
    router.get(`/admin/${path}`, (0, role_1.requireRole)("PLATFORM_SUPER_ADMIN"), (0, asyncHandler_1.asyncHandler)(c.list(model)));
    router.post(`/admin/${path}`, (0, role_1.requireRole)("PLATFORM_SUPER_ADMIN"), (0, validate_1.validate)(subscription_validator_1.adminSchemas[path]), (0, asyncHandler_1.asyncHandler)(c.create(model)));
    router.patch(`/admin/${path}/:id`, (0, role_1.requireRole)("PLATFORM_SUPER_ADMIN"), (0, validate_1.validate)(subscription_validator_1.adminSchemas[path].fork(Object.keys(subscription_validator_1.adminSchemas[path].describe().keys), s => s.optional()).min(1)), (0, asyncHandler_1.asyncHandler)(c.update(model)));
    router.delete(`/admin/${path}/:id`, (0, role_1.requireRole)("PLATFORM_SUPER_ADMIN"), (0, asyncHandler_1.asyncHandler)(c.remove(model)));
}
exports.subscriptionRoutes = router;
