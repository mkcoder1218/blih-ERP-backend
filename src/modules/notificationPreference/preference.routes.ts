
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { preferenceUpdateSchema } from '../../validators/notification.validator';
import { PreferenceController } from './preference.controller';

const router = Router();
const controller = new PreferenceController();

router.use(authRequired);
/**
 * @openapi
 * /api/notification-preferences:
 *   get:
 *     tags: [notificationPreference]
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
router.get('/', asyncHandler(controller.listMine));
/**
 * @openapi
 * /api/notification-preferences:
 *   post:
 *     tags: [notificationPreference]
 *     summary: POST index
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
router.post('/', validate(preferenceUpdateSchema), asyncHandler(controller.updateMine));
export const notificationPreferenceRoutes = router;
