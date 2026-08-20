"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.brainRoutes = void 0;
const express_1 = require("express");
const auth_1 = require("../../middlewares/auth");
const permission_1 = require("../../middlewares/permission");
const module_1 = require("../../middlewares/module");
const asyncHandler_1 = require("../../utils/asyncHandler");
const validate_1 = require("../../middlewares/validate");
const brain_controller_1 = require("./brain.controller");
const brain_validation_1 = require("./brain.validation");
const router = (0, express_1.Router)();
const controller = new brain_controller_1.BrainController();
// Mandatory module guard and base permission check preserving Super Admin bypass
router.use(auth_1.authRequired, (0, module_1.requireActiveModule)('brain'), (0, permission_1.requirePermission)('brain.access'));
// ── Categories ──
router.post('/categories', (0, permission_1.requirePermission)('brain.category.create'), (0, validate_1.validate)(brain_validation_1.createCategorySchema, 'body'), (0, asyncHandler_1.asyncHandler)(controller.createCategory));
router.get('/categories', (0, permission_1.requirePermission)('brain.category.view'), (0, validate_1.validate)(brain_validation_1.listCategoriesQuerySchema, 'query'), (0, asyncHandler_1.asyncHandler)(controller.listCategories));
router.get('/categories/:id', (0, permission_1.requirePermission)('brain.category.view'), (0, validate_1.validate)(brain_validation_1.categoryIdParamSchema, 'params'), (0, asyncHandler_1.asyncHandler)(controller.getCategory));
router.patch('/categories/:id', (0, permission_1.requirePermission)('brain.category.update'), (0, validate_1.validate)(brain_validation_1.categoryIdParamSchema, 'params'), (0, validate_1.validate)(brain_validation_1.updateCategorySchema, 'body'), (0, asyncHandler_1.asyncHandler)(controller.updateCategory));
router.delete('/categories/:id', (0, permission_1.requirePermission)('brain.category.delete'), (0, validate_1.validate)(brain_validation_1.categoryIdParamSchema, 'params'), (0, asyncHandler_1.asyncHandler)(controller.deleteCategory));
router.patch('/categories/:id/restore', (0, permission_1.requirePermission)('brain.category.restore'), (0, validate_1.validate)(brain_validation_1.categoryIdParamSchema, 'params'), (0, asyncHandler_1.asyncHandler)(controller.restoreCategory));
// ── Articles ──
router.post('/articles', (0, permission_1.requirePermission)('brain.article.create'), (0, validate_1.validate)(brain_validation_1.createArticleSchema, 'body'), (0, asyncHandler_1.asyncHandler)(controller.createArticle));
router.get('/articles', (0, permission_1.requirePermission)('brain.article.view'), (0, validate_1.validate)(brain_validation_1.listArticlesQuerySchema, 'query'), (0, asyncHandler_1.asyncHandler)(controller.listArticles));
router.get('/articles/:id', (0, permission_1.requirePermission)('brain.article.view'), (0, validate_1.validate)(brain_validation_1.articleIdParamSchema, 'params'), (0, asyncHandler_1.asyncHandler)(controller.getArticle));
router.patch('/articles/:id', (0, permission_1.requireAnyPermission)('brain.article.update_own', 'brain.article.update_any'), (0, validate_1.validate)(brain_validation_1.articleIdParamSchema, 'params'), (0, validate_1.validate)(brain_validation_1.updateArticleSchema, 'body'), (0, asyncHandler_1.asyncHandler)(controller.updateArticle));
router.delete('/articles/:id', (0, permission_1.requirePermission)('brain.article.delete'), (0, validate_1.validate)(brain_validation_1.articleIdParamSchema, 'params'), (0, asyncHandler_1.asyncHandler)(controller.deleteArticle));
router.patch('/articles/:id/restore', (0, permission_1.requirePermission)('brain.article.restore'), (0, validate_1.validate)(brain_validation_1.articleIdParamSchema, 'params'), (0, asyncHandler_1.asyncHandler)(controller.restoreArticle));
// ── Article Workflow Actions (POST) ──
router.post('/articles/:id/submit-review', (0, permission_1.requirePermission)('brain.article.submit_review'), (0, validate_1.validate)(brain_validation_1.articleIdParamSchema, 'params'), (0, asyncHandler_1.asyncHandler)(controller.submitForReview));
router.post('/articles/:id/approve', (0, permission_1.requirePermission)('brain.article.review'), (0, validate_1.validate)(brain_validation_1.articleIdParamSchema, 'params'), (0, asyncHandler_1.asyncHandler)(controller.approveArticle));
router.post('/articles/:id/request-changes', (0, permission_1.requirePermission)('brain.article.review'), (0, validate_1.validate)(brain_validation_1.articleIdParamSchema, 'params'), (0, validate_1.validate)(brain_validation_1.reviewDecisionSchema, 'body'), (0, asyncHandler_1.asyncHandler)(controller.requestChanges));
router.post('/articles/:id/publish', (0, permission_1.requirePermission)('brain.article.publish'), (0, validate_1.validate)(brain_validation_1.articleIdParamSchema, 'params'), (0, asyncHandler_1.asyncHandler)(controller.publishArticle));
router.post('/articles/:id/unpublish', (0, permission_1.requirePermission)('brain.article.publish'), (0, validate_1.validate)(brain_validation_1.articleIdParamSchema, 'params'), (0, asyncHandler_1.asyncHandler)(controller.unpublishArticle));
router.post('/articles/:id/archive', (0, permission_1.requirePermission)('brain.article.archive'), (0, validate_1.validate)(brain_validation_1.articleIdParamSchema, 'params'), (0, asyncHandler_1.asyncHandler)(controller.archiveArticle));
// Backward compatibility patch endpoints (pointing to same controller handlers)
router.patch('/articles/:id/publish', (0, permission_1.requirePermission)('brain.article.publish'), (0, validate_1.validate)(brain_validation_1.articleIdParamSchema, 'params'), (0, asyncHandler_1.asyncHandler)(controller.publishArticle));
router.patch('/articles/:id/unpublish', (0, permission_1.requirePermission)('brain.article.publish'), (0, validate_1.validate)(brain_validation_1.articleIdParamSchema, 'params'), (0, asyncHandler_1.asyncHandler)(controller.unpublishArticle));
router.patch('/articles/:id/submit-review', (0, permission_1.requirePermission)('brain.article.submit_review'), (0, validate_1.validate)(brain_validation_1.articleIdParamSchema, 'params'), (0, asyncHandler_1.asyncHandler)(controller.submitForReview));
// ── Revisions ──
router.get('/articles/:id/revisions', (0, permission_1.requirePermission)('brain.article.view_revisions'), (0, validate_1.validate)(brain_validation_1.articleIdParamSchema, 'params'), (0, asyncHandler_1.asyncHandler)(controller.listRevisions));
router.get('/articles/:id/revisions/:revisionId', (0, permission_1.requirePermission)('brain.article.view_revisions'), (0, validate_1.validate)(brain_validation_1.revisionIdParamSchema, 'params'), (0, asyncHandler_1.asyncHandler)(controller.getRevision));
router.post('/articles/:id/revisions/:revisionId/restore', (0, permission_1.requirePermission)('brain.article.restore_revision'), (0, validate_1.validate)(brain_validation_1.revisionIdParamSchema, 'params'), (0, asyncHandler_1.asyncHandler)(controller.restoreRevision));
// ── Training Materials ──
router.post('/training', (0, permission_1.requirePermission)('brain.training.create'), (0, validate_1.validate)(brain_validation_1.createTrainingSchema, 'body'), (0, asyncHandler_1.asyncHandler)(controller.createTrainingMaterial));
router.get('/training', (0, permission_1.requirePermission)('brain.training.view'), (0, asyncHandler_1.asyncHandler)(controller.listTrainingMaterials));
router.patch('/training/:id', (0, permission_1.requirePermission)('brain.training.update'), (0, validate_1.validate)(brain_validation_1.updateTrainingSchema, 'body'), (0, asyncHandler_1.asyncHandler)(controller.updateTrainingMaterial));
router.delete('/training/:id', (0, permission_1.requirePermission)('brain.training.delete'), (0, asyncHandler_1.asyncHandler)(controller.deleteTrainingMaterial));
exports.brainRoutes = router;
