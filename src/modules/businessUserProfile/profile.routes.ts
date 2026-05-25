
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { createProfileSchema, updateProfileSchema } from '../../validators/businessUserProfile.validator';
import { ProfileController } from './profile.controller';

const router = Router();
const controller = new ProfileController();

router.use(authRequired);
// 'Me' route is accessible by the user themselves
/**
 * @openapi
 * /api/profiles/me:
 *   get:
 *     tags: [businessUserProfile]
 *     summary: GET /me
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
router.get('/me', asyncHandler(controller.getMe));

// Listing all requires Business Admin
/**
 * @openapi
 * /api/profiles:
 *   get:
 *     tags: [businessUserProfile]
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
router.get('/', requireRole('BUSINESS_ADMIN'), asyncHandler(controller.list));
/**
 * @openapi
 * /api/profiles/{id}:
 *   get:
 *     tags: [businessUserProfile]
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
router.get('/:id', requireRole('BUSINESS_ADMIN'), asyncHandler(controller.get));

// Admin can mutate
/**
 * @openapi
 * /api/profiles:
 *   post:
 *     tags: [businessUserProfile]
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
router.post('/', requireRole('BUSINESS_ADMIN'), validate(createProfileSchema), asyncHandler(controller.create));
/**
 * @openapi
 * /api/profiles/{id}:
 *   patch:
 *     tags: [businessUserProfile]
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
router.patch('/:id', requireRole('BUSINESS_ADMIN'), validate(updateProfileSchema), asyncHandler(controller.update));
/**
 * @openapi
 * /api/profiles/{id}:
 *   delete:
 *     tags: [businessUserProfile]
 *     summary: DELETE /:id
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
router.delete('/:id', requireRole('BUSINESS_ADMIN'), asyncHandler(controller.remove));

export const businessUserProfileRoutes = router;
