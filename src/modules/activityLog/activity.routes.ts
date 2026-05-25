
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { ActivityController } from './activity.controller';

const router = Router();
const controller = new ActivityController();
router.use(authRequired);
/**
 * @openapi
 * /api/activity-logs:
 *   get:
 *     tags: [activity]
 *     summary: GET index
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
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
router.get('/', asyncHandler(controller.list));
export const activityRoutes = router;
