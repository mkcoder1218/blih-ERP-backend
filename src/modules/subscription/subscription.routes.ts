
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { asyncHandler } from '../../utils/asyncHandler';
import { SubscriptionController } from './subscription.controller';

const router = Router();
const controller = new SubscriptionController();

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
router.get('/', authRequired, requireRole('SUPER_ADMIN', 'BUSINESS_ADMIN'), asyncHandler(controller.getSubscription));
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
router.get('/invoices', authRequired, requireRole('SUPER_ADMIN', 'BUSINESS_ADMIN'), asyncHandler(controller.getInvoices));
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
router.post('/cancel', authRequired, requireRole('SUPER_ADMIN', 'BUSINESS_ADMIN'), asyncHandler(controller.cancelSubscription));

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
router.post('/assign', authRequired, requireRole('SUPER_ADMIN'), asyncHandler(controller.assignSubscription));
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
router.post('/invoices', authRequired, requireRole('SUPER_ADMIN'), asyncHandler(controller.createInvoice));
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
router.post('/invoices/:invoiceId/payments', authRequired, requireRole('SUPER_ADMIN'), asyncHandler(controller.recordPayment));

export const subscriptionRoutes = router;
