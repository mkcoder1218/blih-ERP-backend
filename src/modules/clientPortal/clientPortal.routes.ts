
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { asyncHandler } from '../../utils/asyncHandler';
import { ClientPortalController } from './clientPortal.controller';
import { db } from '../../models';

const router = Router();
const controller = new ClientPortalController();

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
router.post('/users', authRequired, requireRole('ACCOUNT_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.createPortalUser));
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
router.post('/access', authRequired, requireRole('ACCOUNT_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.createPortalAccess));

// Portal endpoints (accessed by the client)
// Requires a middleware to assert the logged in user is actually a ClientPortalUser
const requirePortalUser = async (req: Request, res: Response, next: NextFunction) => {
  const portalUser = await db.ClientPortalUser.findOne({ where: { userId: req.user!.id, businessId: req.user!.businessId, status: 'active' } });
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
router.get('/my-projects', authRequired, requirePortalUser, asyncHandler(controller.getClientProjects));
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
router.get('/my-invoices', authRequired, requirePortalUser, asyncHandler(controller.getClientInvoices));
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
router.post('/my-requests', authRequired, requirePortalUser, asyncHandler(controller.submitRequest));
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
router.post('/my-feedbacks', authRequired, requirePortalUser, asyncHandler(controller.submitFeedback));

export const clientPortalRoutes = router;
