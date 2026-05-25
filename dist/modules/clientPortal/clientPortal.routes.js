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
// Internal endpoints for setup (accessed by Account Managers, Admins)
/**
 * @openapi
 * /api/v1/client-portal/users:
 *   post:
 *     tags: [client-portal]
 *     summary: POST /users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/users', auth_1.authRequired, (0, role_1.requireRole)('ACCOUNT_MANAGER', 'BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.createPortalUser));
/**
 * @openapi
 * /api/v1/client-portal/access:
 *   post:
 *     tags: [client-portal]
 *     summary: POST /access
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/access', auth_1.authRequired, (0, role_1.requireRole)('ACCOUNT_MANAGER', 'BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.createPortalAccess));
// Portal endpoints (accessed by the client)
// Requires a middleware to assert the logged in user is actually a ClientPortalUser
const requirePortalUser = async (req, res, next) => {
    const portalUser = await models_1.db.ClientPortalUser.findOne({ where: { userId: req.user.id, businessId: req.user.businessId, status: 'active' } });
    if (!portalUser) {
        return res.status(403).json({ message: 'Access denied: not a designated client portal user.' });
    }
    req.portalUser = portalUser;
    next();
};
/**
 * @openapi
 * /api/v1/client-portal/my-projects:
 *   get:
 *     tags: [client-portal]
 *     summary: GET /my-projects
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.get('/my-projects', auth_1.authRequired, requirePortalUser, (0, asyncHandler_1.asyncHandler)(controller.getClientProjects));
/**
 * @openapi
 * /api/v1/client-portal/my-invoices:
 *   get:
 *     tags: [client-portal]
 *     summary: GET /my-invoices
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.get('/my-invoices', auth_1.authRequired, requirePortalUser, (0, asyncHandler_1.asyncHandler)(controller.getClientInvoices));
/**
 * @openapi
 * /api/v1/client-portal/my-requests:
 *   post:
 *     tags: [client-portal]
 *     summary: POST /my-requests
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/my-requests', auth_1.authRequired, requirePortalUser, (0, asyncHandler_1.asyncHandler)(controller.submitRequest));
/**
 * @openapi
 * /api/v1/client-portal/my-feedbacks:
 *   post:
 *     tags: [client-portal]
 *     summary: POST /my-feedbacks
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         $ref: '#/components/responses/400'
 *       401:
 *         $ref: '#/components/responses/401'
 *       403:
 *         $ref: '#/components/responses/403'
 *       404:
 *         $ref: '#/components/responses/404'
 *       500:
 *         $ref: '#/components/responses/500'
 */
router.post('/my-feedbacks', auth_1.authRequired, requirePortalUser, (0, asyncHandler_1.asyncHandler)(controller.submitFeedback));
exports.clientPortalRoutes = router;
