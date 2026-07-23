"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clientPortalRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const role_1 = require("../../middlewares/role");
const asyncHandler_1 = require("../../utils/asyncHandler");
const clientPortal_controller_1 = require("./clientPortal.controller");
const models_1 = require("../../models");
const router = (0, express_1.Router)();
const controller = new clientPortal_controller_1.ClientPortalController();
/**
 * Internal endpoints used to configure client portal access.
 */
router.post("/users", auth_1.authRequired, (0, role_1.requireRole)("ACCOUNT_MANAGER", "BUSINESS_ADMIN"), (0, asyncHandler_1.asyncHandler)(controller.createPortalUser));
router.post("/access", auth_1.authRequired, (0, role_1.requireRole)("ACCOUNT_MANAGER", "BUSINESS_ADMIN"), (0, asyncHandler_1.asyncHandler)(controller.createPortalAccess));
/**
 * Verifies that the authenticated ERP user is connected to an active
 * client portal user record.
 */
const requirePortalUser = async (req, res, next) => {
    try {
        const authenticatedUser = req.user;
        if (!authenticatedUser) {
            res.status(401).json({
                message: "Authentication is required.",
            });
            return;
        }
        const portalUser = await models_1.db.ClientPortalUser.findOne({
            where: {
                userId: authenticatedUser.id,
                businessId: authenticatedUser.businessId,
                status: "active",
            },
        });
        if (!portalUser) {
            res.status(403).json({
                message: "Access denied: not a designated client portal user.",
            });
            return;
        }
        req.portalUser = portalUser;
        next();
    }
    catch (error) {
        next(error);
    }
};
router.get("/my-projects", auth_1.authRequired, requirePortalUser, (0, asyncHandler_1.asyncHandler)(controller.getClientProjects));
router.get("/my-invoices", auth_1.authRequired, requirePortalUser, (0, asyncHandler_1.asyncHandler)(controller.getClientInvoices));
router.post("/my-requests", auth_1.authRequired, requirePortalUser, (0, asyncHandler_1.asyncHandler)(controller.submitRequest));
router.post("/my-feedbacks", auth_1.authRequired, requirePortalUser, (0, asyncHandler_1.asyncHandler)(controller.submitFeedback));
exports.clientPortalRoutes = router;
