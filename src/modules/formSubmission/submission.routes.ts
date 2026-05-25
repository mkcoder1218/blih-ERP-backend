
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { submitDataSchema } from '../../validators/formSubmission.validator';
import { SubmissionController } from './submission.controller';

const router = Router();
const controller = new SubmissionController();
router.use(authRequired);
/**
 * @openapi
 * /api/form-submissions/mine:
 *   get:
 *     tags: [formSubmission]
 *     summary: GET /mine
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
router.get('/mine', asyncHandler(controller.listMine));
/**
 * @openapi
 * /api/form-submissions/{id}:
 *   get:
 *     tags: [formSubmission]
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
/**
 * @openapi
 * /api/form-submissions:
 *   post:
 *     tags: [formSubmission]
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
router.post('/', validate(submitDataSchema), asyncHandler(controller.create));
export const formSubmissionRoutes = router;
