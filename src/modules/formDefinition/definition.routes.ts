
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { createFormDefSchema, createFormFieldSchema } from '../../validators/formDefinition.validator';
import { DefinitionController } from './definition.controller';

const router = Router();
const controller = new DefinitionController();
router.use(authRequired);
// List for submitting
/**
 * @openapi
 * /api/form-definitions:
 *   get:
 *     tags: [formDefinition]
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
/**
 * @openapi
 * /api/form-definitions/{id}:
 *   get:
 *     tags: [formDefinition]
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
router.get('/:id', asyncHandler(controller.get));
// Design bounds
/**
 * @openapi
 * /api/form-definitions:
 *   post:
 *     tags: [formDefinition]
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
router.post('/', requireRole('BUSINESS_ADMIN'), validate(createFormDefSchema), asyncHandler(controller.create));
/**
 * @openapi
 * /api/form-definitions/{id}:
 *   patch:
 *     tags: [formDefinition]
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
router.patch('/:id', requireRole('BUSINESS_ADMIN'), asyncHandler(controller.update));
/**
 * @openapi
 * /api/form-definitions/fields:
 *   post:
 *     tags: [formDefinition]
 *     summary: POST /fields
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
router.post('/fields', requireRole('BUSINESS_ADMIN'), validate(createFormFieldSchema), asyncHandler(controller.createField));
/**
 * @openapi
 * /api/form-definitions/fields/{id}:
 *   patch:
 *     tags: [formDefinition]
 *     summary: PATCH /fields/:id
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
router.patch('/fields/:id', requireRole('BUSINESS_ADMIN'), asyncHandler(controller.updateField));
export const formDefinitionRoutes = router;
