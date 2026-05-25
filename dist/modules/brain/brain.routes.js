"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.brainRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const role_1 = require("../../middlewares/role");
const module_1 = require("../../middlewares/module");
const asyncHandler_1 = require("../../utils/asyncHandler");
const brain_controller_1 = require("./brain.controller");
const router = (0, express_1.Router)();
const controller = new brain_controller_1.BrainController();
router.use(auth_1.authRequired, (0, module_1.requireActiveModule)('brain'));
// Categories
/**
 * @openapi
 * /api/v1/brain/categories:
 *   post:
 *     tags: [brain]
 *     summary: POST /categories
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
router.post('/categories', (0, role_1.requireRole)('KNOWLEDGE_MANAGER', 'BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.createCategory));
/**
 * @openapi
 * /api/v1/brain/categories:
 *   get:
 *     tags: [brain]
 *     summary: GET /categories
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
router.get('/categories', (0, asyncHandler_1.asyncHandler)(controller.listCategories));
// Articles
/**
 * @openapi
 * /api/v1/brain/articles:
 *   post:
 *     tags: [brain]
 *     summary: POST /articles
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
router.post('/articles', (0, asyncHandler_1.asyncHandler)(controller.createArticle));
/**
 * @openapi
 * /api/v1/brain/articles:
 *   get:
 *     tags: [brain]
 *     summary: GET /articles
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
router.get('/articles', (0, asyncHandler_1.asyncHandler)(controller.listArticles));
/**
 * @openapi
 * /api/v1/brain/articles/{id}:
 *   get:
 *     tags: [brain]
 *     summary: GET /articles/:id
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
router.get('/articles/:id', (0, asyncHandler_1.asyncHandler)(controller.getArticle));
/**
 * @openapi
 * /api/v1/brain/articles/{id}:
 *   patch:
 *     tags: [brain]
 *     summary: PATCH /articles/:id
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
router.patch('/articles/:id', (0, asyncHandler_1.asyncHandler)(controller.updateArticle));
/**
 * @openapi
 * /api/v1/brain/articles/{id}/publish:
 *   patch:
 *     tags: [brain]
 *     summary: PATCH /articles/:id/publish
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
router.patch('/articles/:id/publish', (0, role_1.requireRole)('KNOWLEDGE_MANAGER', 'BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.publishArticle));
/**
 * @openapi
 * /api/v1/brain/articles/{id}/unpublish:
 *   patch:
 *     tags: [brain]
 *     summary: PATCH /articles/:id/unpublish
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
router.patch('/articles/:id/unpublish', (0, role_1.requireRole)('KNOWLEDGE_MANAGER', 'BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.unpublishArticle));
/**
 * @openapi
 * /api/v1/brain/articles/{id}/submit-review:
 *   patch:
 *     tags: [brain]
 *     summary: PATCH /articles/:id/submit-review
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
router.patch('/articles/:id/submit-review', (0, asyncHandler_1.asyncHandler)(controller.submitForReview));
// Training Materials
/**
 * @openapi
 * /api/v1/brain/training:
 *   post:
 *     tags: [brain]
 *     summary: POST /training
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
router.post('/training', (0, role_1.requireRole)('KNOWLEDGE_MANAGER', 'BUSINESS_ADMIN'), (0, asyncHandler_1.asyncHandler)(controller.createTrainingMaterial));
/**
 * @openapi
 * /api/v1/brain/training:
 *   get:
 *     tags: [brain]
 *     summary: GET /training
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
router.get('/training', (0, asyncHandler_1.asyncHandler)(controller.listTrainingMaterials));
exports.brainRoutes = router;
