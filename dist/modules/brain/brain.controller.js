"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrainController = void 0;
const brain_service_1 = require("./brain.service");
const auditLog_service_1 = require("../../services/auditLog.service");
class BrainController {
    constructor() {
        this.service = new brain_service_1.BrainService();
        // Categories
        this.createCategory = async (req, res) => {
            try {
                const cat = await this.service.createCategory(req.user.businessId, req.body);
                await auditLog_service_1.AuditLogService.log('CREATE_KB_CATEGORY', 'brain_category', String(cat.id), null, cat, req);
                res.status(201).json({ category: cat });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        this.listCategories = async (req, res) => {
            res.json(await this.service.listCategories(req.user.businessId));
        };
        // Articles
        this.createArticle = async (req, res) => {
            try {
                const article = await this.service.createArticle(req.user.businessId, req.user.id, req.body);
                await auditLog_service_1.AuditLogService.log('CREATE_KB_ARTICLE', 'brain_article', String(article.id), null, article, req);
                res.status(201).json({ article });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        this.updateArticle = async (req, res) => {
            try {
                const { changeSummary, ...data } = req.body;
                const article = await this.service.updateArticle(req.user.businessId, req.params.id, req.user.id, data, changeSummary);
                await auditLog_service_1.AuditLogService.log('UPDATE_KB_ARTICLE', 'brain_article', String(article.id), null, { changeSummary }, req);
                res.json({ article });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        this.publishArticle = async (req, res) => {
            try {
                const article = await this.service.publishArticle(req.user.businessId, req.params.id);
                await auditLog_service_1.AuditLogService.log('PUBLISH_KB_ARTICLE', 'brain_article', String(article.id), null, null, req);
                res.json({ article });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        this.unpublishArticle = async (req, res) => {
            try {
                const article = await this.service.unpublishArticle(req.user.businessId, req.params.id);
                await auditLog_service_1.AuditLogService.log('UNPUBLISH_KB_ARTICLE', 'brain_article', String(article.id), null, null, req);
                res.json({ article });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        this.submitForReview = async (req, res) => {
            try {
                const article = await this.service.getArticle(req.user.businessId, req.params.id);
                if (!article)
                    return res.status(404).json({ message: 'Article not found' });
                await article.update({ status: 'in_review' });
                await this.service.notifyPublicationRequest(req.user.businessId, article.id, article.title);
                await auditLog_service_1.AuditLogService.log('SUBMIT_KB_REVIEW', 'brain_article', String(article.id), null, null, req);
                res.json({ article });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        this.getArticle = async (req, res) => {
            const article = await this.service.getArticle(req.user.businessId, req.params.id);
            if (!article)
                return res.status(404).json({ message: 'Article not found' });
            res.json({ article });
        };
        this.listArticles = async (req, res) => {
            const page = parseInt(req.query.page) || 1;
            const size = parseInt(req.query.size) || 20;
            res.json(await this.service.listArticles(req.user.businessId, req.query, page, size));
        };
        // Training Materials
        this.createTrainingMaterial = async (req, res) => {
            try {
                const tm = await this.service.createTrainingMaterial(req.user.businessId, req.body);
                await auditLog_service_1.AuditLogService.log('CREATE_TRAINING_MATERIAL', 'brain_training', String(tm.id), null, tm, req);
                res.status(201).json({ trainingMaterial: tm });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        this.listTrainingMaterials = async (req, res) => {
            const page = parseInt(req.query.page) || 1;
            const size = parseInt(req.query.size) || 20;
            res.json(await this.service.listTrainingMaterials(req.user.businessId, page, size));
        };
    }
}
exports.BrainController = BrainController;
