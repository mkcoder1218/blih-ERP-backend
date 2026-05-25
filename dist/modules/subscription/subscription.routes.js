"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const role_1 = require("../../middlewares/role");
const asyncHandler_1 = require("../../utils/asyncHandler");
const subscription_controller_1 = require("./subscription.controller");
const router = (0, express_1.Router)();
const controller = new subscription_controller_1.SubscriptionController();
// Business Admin Operations
/**
 * @openapi
 * /api/v1/subscription:
 *   get:
 *     tags: [subscription]
 *     summary: GET index
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
router.get('/', auth_1.authRequired, (0, role_1.requireRole)('SUPER_ADMIN', 'BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.getSubscription));
/**
 * @openapi
 * /api/v1/subscription/invoices:
 *   get:
 *     tags: [subscription]
 *     summary: GET /invoices
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
router.get('/invoices', auth_1.authRequired, (0, role_1.requireRole)('SUPER_ADMIN', 'BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.getInvoices));
/**
 * @openapi
 * /api/v1/subscription/cancel:
 *   post:
 *     tags: [subscription]
 *     summary: POST /cancel
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
router.post('/cancel', auth_1.authRequired, (0, role_1.requireRole)('SUPER_ADMIN', 'BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.cancelSubscription));
// Super Admin / System Operations
/**
 * @openapi
 * /api/v1/subscription/assign:
 *   post:
 *     tags: [subscription]
 *     summary: POST /assign
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
router.post('/assign', auth_1.authRequired, (0, role_1.requireRole)('SUPER_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.assignSubscription));
/**
 * @openapi
 * /api/v1/subscription/invoices:
 *   post:
 *     tags: [subscription]
 *     summary: POST /invoices
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
router.post('/invoices', auth_1.authRequired, (0, role_1.requireRole)('SUPER_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.createInvoice));
/**
 * @openapi
 * /api/v1/subscription/invoices/{invoiceId}/payments:
 *   post:
 *     tags: [subscription]
 *     summary: POST /invoices/:invoiceId/payments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
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
router.post('/invoices/:invoiceId/payments', auth_1.authRequired, (0, role_1.requireRole)('SUPER_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.recordPayment));
exports.subscriptionRoutes = router;
