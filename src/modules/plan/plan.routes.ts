
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { createPlanSchema, updatePlanSchema } from '../../validators/plan.validator';
import { PlanController } from './plan.controller';
const router = Router();
const controller = new PlanController();
router.use(authRequired);
/**
 * @openapi
 * /api/plans:
 *   get:
 *     tags: [plan]
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
router.get('/', requireRole('PLATFORM_SUPER_ADMIN'), asyncHandler(controller.list));
/**
 * @openapi
 * /api/plans/{id}:
 *   get:
 *     tags: [plan]
 *     summary: GET /:id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
router.get('/:id', requireRole('PLATFORM_SUPER_ADMIN'), asyncHandler(controller.get));
/**
 * @openapi
 * /api/plans:
 *   post:
 *     tags: [plan]
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
router.post('/', requireRole('PLATFORM_SUPER_ADMIN'), validate(createPlanSchema), asyncHandler(controller.create));
/**
 * @openapi
 * /api/plans/{id}:
 *   patch:
 *     tags: [plan]
 *     summary: PATCH /:id
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
router.patch('/:id', requireRole('PLATFORM_SUPER_ADMIN'), validate(updatePlanSchema), asyncHandler(controller.update));
router.delete('/:id', requireRole('PLATFORM_SUPER_ADMIN'), asyncHandler(controller.remove));
export const planRoutes = router;
