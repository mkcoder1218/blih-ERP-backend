import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requirePermission, requireAnyPermission } from '../../middlewares/permission';
import { requireActiveModule } from '../../middlewares/module';
import { asyncHandler } from '../../utils/asyncHandler';
import { validate } from '../../middlewares/validate';
import { BrainController } from './brain.controller';
import { brainClientRoutes } from './brain.clients.routes';
import {
  createCategorySchema,
  updateCategorySchema,
  categoryIdParamSchema,
  listCategoriesQuerySchema,
  createArticleSchema,
  updateArticleSchema,
  articleIdParamSchema,
  reviewDecisionSchema,
  listArticlesQuerySchema,
  revisionIdParamSchema,
  createTrainingSchema,
  updateTrainingSchema
} from './brain.validation';

const router = Router();
const controller = new BrainController();

// Authentication is mandatory for every Brain route.
router.use(authRequired);

// ── Client Directory ──
// This cross-module directory deliberately sits before brain.access/module
// guards. Business Admins and Project Managers use the same Client records
// from Brain and Projects, even when CRM is not subscribed.
router.use('/clients', brainClientRoutes);

// Mandatory Brain module guard and base permission check preserving Super Admin bypass.
router.use(requireActiveModule('brain'), requirePermission('brain.access'));

// ── Categories ──
router.post(
  '/categories',
  requirePermission('brain.category.create'),
  validate(createCategorySchema, 'body'),
  asyncHandler(controller.createCategory)
);

router.get(
  '/categories',
  requirePermission('brain.category.view'),
  validate(listCategoriesQuerySchema, 'query'),
  asyncHandler(controller.listCategories)
);

router.get(
  '/categories/:id',
  requirePermission('brain.category.view'),
  validate(categoryIdParamSchema, 'params'),
  asyncHandler(controller.getCategory)
);

router.patch(
  '/categories/:id',
  requirePermission('brain.category.update'),
  validate(categoryIdParamSchema, 'params'),
  validate(updateCategorySchema, 'body'),
  asyncHandler(controller.updateCategory)
);

router.delete(
  '/categories/:id',
  requirePermission('brain.category.delete'),
  validate(categoryIdParamSchema, 'params'),
  asyncHandler(controller.deleteCategory)
);

router.patch(
  '/categories/:id/restore',
  requirePermission('brain.category.restore'),
  validate(categoryIdParamSchema, 'params'),
  asyncHandler(controller.restoreCategory)
);

// ── Articles ──
router.post(
  '/articles',
  requirePermission('brain.article.create'),
  validate(createArticleSchema, 'body'),
  asyncHandler(controller.createArticle)
);

router.get(
  '/articles',
  requirePermission('brain.article.view'),
  validate(listArticlesQuerySchema, 'query'),
  asyncHandler(controller.listArticles)
);

router.get(
  '/articles/:id',
  requirePermission('brain.article.view'),
  validate(articleIdParamSchema, 'params'),
  asyncHandler(controller.getArticle)
);

router.patch(
  '/articles/:id',
  requireAnyPermission('brain.article.update_own', 'brain.article.update_any'),
  validate(articleIdParamSchema, 'params'),
  validate(updateArticleSchema, 'body'),
  asyncHandler(controller.updateArticle)
);

router.delete(
  '/articles/:id',
  requirePermission('brain.article.delete'),
  validate(articleIdParamSchema, 'params'),
  asyncHandler(controller.deleteArticle)
);

router.patch(
  '/articles/:id/restore',
  requirePermission('brain.article.restore'),
  validate(articleIdParamSchema, 'params'),
  asyncHandler(controller.restoreArticle)
);

// ── Article Workflow Actions (POST) ──
router.post(
  '/articles/:id/submit-review',
  requirePermission('brain.article.submit_review'),
  validate(articleIdParamSchema, 'params'),
  asyncHandler(controller.submitForReview)
);

router.post(
  '/articles/:id/approve',
  requirePermission('brain.article.review'),
  validate(articleIdParamSchema, 'params'),
  asyncHandler(controller.approveArticle)
);

router.post(
  '/articles/:id/request-changes',
  requirePermission('brain.article.review'),
  validate(articleIdParamSchema, 'params'),
  validate(reviewDecisionSchema, 'body'),
  asyncHandler(controller.requestChanges)
);

router.post(
  '/articles/:id/publish',
  requirePermission('brain.article.publish'),
  validate(articleIdParamSchema, 'params'),
  asyncHandler(controller.publishArticle)
);

router.post(
  '/articles/:id/unpublish',
  requirePermission('brain.article.publish'),
  validate(articleIdParamSchema, 'params'),
  asyncHandler(controller.unpublishArticle)
);

router.post(
  '/articles/:id/archive',
  requirePermission('brain.article.archive'),
  validate(articleIdParamSchema, 'params'),
  asyncHandler(controller.archiveArticle)
);

// Backward compatibility patch endpoints (pointing to same controller handlers)
router.patch(
  '/articles/:id/publish',
  requirePermission('brain.article.publish'),
  validate(articleIdParamSchema, 'params'),
  asyncHandler(controller.publishArticle)
);

router.patch(
  '/articles/:id/unpublish',
  requirePermission('brain.article.publish'),
  validate(articleIdParamSchema, 'params'),
  asyncHandler(controller.unpublishArticle)
);

router.patch(
  '/articles/:id/submit-review',
  requirePermission('brain.article.submit_review'),
  validate(articleIdParamSchema, 'params'),
  asyncHandler(controller.submitForReview)
);

// ── Revisions ──
router.get(
  '/articles/:id/revisions',
  requirePermission('brain.article.view_revisions'),
  validate(articleIdParamSchema, 'params'),
  asyncHandler(controller.listRevisions)
);

router.get(
  '/articles/:id/revisions/:revisionId',
  requirePermission('brain.article.view_revisions'),
  validate(revisionIdParamSchema, 'params'),
  asyncHandler(controller.getRevision)
);

router.post(
  '/articles/:id/revisions/:revisionId/restore',
  requirePermission('brain.article.restore_revision'),
  validate(revisionIdParamSchema, 'params'),
  asyncHandler(controller.restoreRevision)
);

// ── Training Materials ──
router.post(
  '/training',
  requirePermission('brain.training.create'),
  validate(createTrainingSchema, 'body'),
  asyncHandler(controller.createTrainingMaterial)
);

router.get(
  '/training',
  requirePermission('brain.training.view'),
  asyncHandler(controller.listTrainingMaterials)
);

router.patch(
  '/training/:id',
  requirePermission('brain.training.update'),
  validate(updateTrainingSchema, 'body'),
  asyncHandler(controller.updateTrainingMaterial)
);

router.delete(
  '/training/:id',
  requirePermission('brain.training.delete'),
  asyncHandler(controller.deleteTrainingMaterial)
);

export const brainRoutes = router;
