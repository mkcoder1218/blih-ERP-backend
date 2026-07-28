"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrainController = void 0;
const brain_service_1 = require("./brain.service");
const auditLog_service_1 = require("../../services/auditLog.service");
class BrainController {
    constructor() {
        this.service = new brain_service_1.BrainService();
        // ── Categories ──
        this.createCategory = async (req, res) => {
            const category = await this.service.createCategory(req.user.businessId, req.body);
            await auditLog_service_1.AuditLogService.log('CREATE_BRAIN_CATEGORY', 'brain_category', String(category.id), null, category, req);
            res.status(201).json({ category });
        };
        this.listCategories = async (req, res) => {
            const result = await this.service.listCategories(req.user.businessId, req.query, req.user.permissions || []);
            res.json(result);
        };
        this.getCategory = async (req, res) => {
            const category = await this.service.getCategory(req.user.businessId, req.params.id);
            res.json({ category });
        };
        this.updateCategory = async (req, res) => {
            const before = await this.service.getCategory(req.user.businessId, req.params.id);
            const category = await this.service.updateCategory(req.user.businessId, req.params.id, req.body);
            await auditLog_service_1.AuditLogService.log('UPDATE_BRAIN_CATEGORY', 'brain_category', String(category.id), before, category, req);
            res.json({ category });
        };
        this.deleteCategory = async (req, res) => {
            const before = await this.service.getCategory(req.user.businessId, req.params.id);
            const result = await this.service.deleteCategory(req.user.businessId, req.params.id);
            await auditLog_service_1.AuditLogService.log('DELETE_BRAIN_CATEGORY', 'brain_category', req.params.id, before, null, req);
            res.json(result);
        };
        this.restoreCategory = async (req, res) => {
            const category = await this.service.restoreCategory(req.user.businessId, req.params.id);
            await auditLog_service_1.AuditLogService.log('RESTORE_BRAIN_CATEGORY', 'brain_category', String(category.id), null, category, req);
            res.json({ category });
        };
        // ── Articles ──
        this.createArticle = async (req, res) => {
            const article = await this.service.createArticle(req.user.businessId, req.user.id, req.body);
            await auditLog_service_1.AuditLogService.log('CREATE_BRAIN_ARTICLE', 'brain_article', String(article.id), null, article, req);
            res.status(201).json({ article });
        };
        this.listArticles = async (req, res) => {
            const result = await this.service.listArticles(req.user.businessId, req.user, req.query);
            res.json(result);
        };
        this.getArticle = async (req, res) => {
            const article = await this.service.getArticle(req.user.businessId, req.params.id, req.user);
            res.json({ article });
        };
        this.updateArticle = async (req, res) => {
            const { changeSummary, ...data } = req.body;
            const before = await this.service.getArticle(req.user.businessId, req.params.id, req.user);
            const article = await this.service.updateArticle(req.user.businessId, req.params.id, req.user, data, changeSummary);
            await auditLog_service_1.AuditLogService.log('UPDATE_BRAIN_ARTICLE', 'brain_article', String(article.id), before, { article, changeSummary }, req);
            res.json({ article });
        };
        this.deleteArticle = async (req, res) => {
            const before = await this.service.getArticle(req.user.businessId, req.params.id, req.user);
            const result = await this.service.deleteArticle(req.user.businessId, req.params.id, req.user);
            await auditLog_service_1.AuditLogService.log('DELETE_BRAIN_ARTICLE', 'brain_article', req.params.id, before, null, req);
            res.json(result);
        };
        this.restoreArticle = async (req, res) => {
            const article = await this.service.restoreArticle(req.user.businessId, req.params.id, req.user);
            await auditLog_service_1.AuditLogService.log('RESTORE_BRAIN_ARTICLE', 'brain_article', String(article.id), null, article, req);
            res.json({ article });
        };
        // ── Workflow Actions ──
        this.submitForReview = async (req, res) => {
            const before = await this.service.getArticle(req.user.businessId, req.params.id, req.user);
            const article = await this.service.submitForReview(req.user.businessId, req.params.id, req.user);
            await auditLog_service_1.AuditLogService.log('SUBMIT_BRAIN_ARTICLE_REVIEW', 'brain_article', String(article.id), before, article, req);
            res.json({ article });
        };
        this.approveArticle = async (req, res) => {
            const before = await this.service.getArticle(req.user.businessId, req.params.id, req.user);
            const article = await this.service.approveArticle(req.user.businessId, req.params.id, req.user);
            await auditLog_service_1.AuditLogService.log('APPROVE_BRAIN_ARTICLE', 'brain_article', String(article.id), before, article, req);
            res.json({ article });
        };
        this.requestChanges = async (req, res) => {
            const { comment } = req.body;
            const before = await this.service.getArticle(req.user.businessId, req.params.id, req.user);
            const article = await this.service.requestChanges(req.user.businessId, req.params.id, req.user, comment);
            await auditLog_service_1.AuditLogService.log('REQUEST_BRAIN_ARTICLE_CHANGES', 'brain_article', String(article.id), before, { article, comment }, req);
            res.json({ article });
        };
        this.publishArticle = async (req, res) => {
            const before = await this.service.getArticle(req.user.businessId, req.params.id, req.user);
            const article = await this.service.publishArticle(req.user.businessId, req.params.id, req.user);
            await auditLog_service_1.AuditLogService.log('PUBLISH_BRAIN_ARTICLE', 'brain_article', String(article.id), before, article, req);
            res.json({ article });
        };
        this.unpublishArticle = async (req, res) => {
            const before = await this.service.getArticle(req.user.businessId, req.params.id, req.user);
            const article = await this.service.unpublishArticle(req.user.businessId, req.params.id, req.user);
            await auditLog_service_1.AuditLogService.log('UNPUBLISH_BRAIN_ARTICLE', 'brain_article', String(article.id), before, { article, oldPublishedAt: before.publishedAt, oldPublishedByUserId: before.publishedByUserId }, req);
            res.json({ article });
        };
        this.archiveArticle = async (req, res) => {
            const before = await this.service.getArticle(req.user.businessId, req.params.id, req.user);
            const article = await this.service.archiveArticle(req.user.businessId, req.params.id, req.user);
            await auditLog_service_1.AuditLogService.log('ARCHIVE_BRAIN_ARTICLE', 'brain_article', String(article.id), before, article, req);
            res.json({ article });
        };
        // ── Revisions ──
        this.listRevisions = async (req, res) => {
            const page = parseInt(req.query.page) || 1;
            const size = parseInt(req.query.size) || 20;
            const result = await this.service.listRevisions(req.user.businessId, req.params.id, req.user, page, size);
            res.json(result);
        };
        this.getRevision = async (req, res) => {
            const revision = await this.service.getRevision(req.user.businessId, req.params.id, req.params.revisionId, req.user);
            res.json({ revision });
        };
        this.restoreRevision = async (req, res) => {
            const article = await this.service.restoreRevision(req.user.businessId, req.params.id, req.params.revisionId, req.user);
            await auditLog_service_1.AuditLogService.log('RESTORE_BRAIN_ARTICLE_REVISION', 'brain_article', String(article.id), null, { article, restoredFromRevisionId: req.params.revisionId }, req);
            res.json({ article });
        };
        // ── Training Materials ──
        this.createTrainingMaterial = async (req, res) => {
            const trainingMaterial = await this.service.createTrainingMaterial(req.user.businessId, req.body);
            await auditLog_service_1.AuditLogService.log('CREATE_TRAINING_MATERIAL', 'brain_training', String(trainingMaterial.id), null, trainingMaterial, req);
            res.status(201).json({ trainingMaterial });
        };
        this.updateTrainingMaterial = async (req, res) => {
            const trainingMaterial = await this.service.updateTrainingMaterial(req.user.businessId, req.params.id, req.body);
            await auditLog_service_1.AuditLogService.log('UPDATE_TRAINING_MATERIAL', 'brain_training', String(trainingMaterial.id), null, trainingMaterial, req);
            res.json({ trainingMaterial });
        };
        this.deleteTrainingMaterial = async (req, res) => {
            const result = await this.service.deleteTrainingMaterial(req.user.businessId, req.params.id);
            await auditLog_service_1.AuditLogService.log('DELETE_TRAINING_MATERIAL', 'brain_training', req.params.id, null, null, req);
            res.json(result);
        };
        this.listTrainingMaterials = async (req, res) => {
            const page = parseInt(req.query.page) || 1;
            const size = parseInt(req.query.size) || 20;
            const result = await this.service.listTrainingMaterials(req.user.businessId, page, size);
            res.json(result);
        };
    }
}
exports.BrainController = BrainController;
