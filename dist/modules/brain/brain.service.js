"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrainService = void 0;
const models_1 = require("../../models");
const notification_service_1 = require("../notification/notification.service");
const sequelize_1 = require("sequelize");
class BrainService {
    // ── Categories ──
    async createCategory(businessId, data) {
        return models_1.db.KnowledgeCategory.create({ ...data, businessId });
    }
    async listCategories(businessId) {
        return models_1.db.KnowledgeCategory.findAll({
            where: { businessId },
            include: [{ model: models_1.db.KnowledgeCategory, as: 'subcategories' }]
        });
    }
    // ── Articles ──
    async createArticle(businessId, authorUserId, data) {
        const slug = (data.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const article = await models_1.db.KnowledgeArticle.create({
            ...data, businessId, authorUserId, slug, version: 1
        });
        // Create initial revision snapshot
        await models_1.db.KnowledgeRevision.create({
            businessId, articleId: article.id, revisedByUserId: authorUserId,
            version: 1, changeSummary: 'Initial creation',
            contentSnapshot: { title: article.title, summary: article.summary, content: article.content }
        });
        return article;
    }
    async updateArticle(businessId, articleId, userId, data, changeSummary) {
        const article = await models_1.db.KnowledgeArticle.findOne({ where: { id: articleId, businessId } });
        if (!article)
            throw new Error('Article not found');
        const newVersion = article.version + 1;
        await article.update({ ...data, version: newVersion });
        // Create revision record
        await models_1.db.KnowledgeRevision.create({
            businessId, articleId, revisedByUserId: userId,
            version: newVersion, changeSummary: changeSummary || 'Updated',
            contentSnapshot: { title: article.title, summary: article.summary, content: article.content }
        });
        return article;
    }
    async publishArticle(businessId, articleId) {
        const article = await models_1.db.KnowledgeArticle.findOne({ where: { id: articleId, businessId } });
        if (!article)
            throw new Error('Article not found');
        await article.update({ status: 'published', publishedAt: new Date() });
        return article;
    }
    async unpublishArticle(businessId, articleId) {
        const article = await models_1.db.KnowledgeArticle.findOne({ where: { id: articleId, businessId } });
        if (!article)
            throw new Error('Article not found');
        await article.update({ status: 'draft', publishedAt: null });
        return article;
    }
    async listArticles(businessId, query, page, size) {
        const where = { businessId };
        if (query.categoryId)
            where.categoryId = query.categoryId;
        if (query.status)
            where.status = query.status;
        if (query.visibility)
            where.visibility = query.visibility;
        if (query.search) {
            where[sequelize_1.Op.or] = [
                { title: { [sequelize_1.Op.iLike]: `%${query.search}%` } },
                { summary: { [sequelize_1.Op.iLike]: `%${query.search}%` } }
            ];
        }
        return models_1.db.KnowledgeArticle.findAndCountAll({
            where, offset: (page - 1) * size, limit: size,
            include: [{ model: models_1.db.KnowledgeCategory }],
            order: [['updatedAt', 'DESC']]
        });
    }
    async getArticle(businessId, articleId) {
        return models_1.db.KnowledgeArticle.findOne({
            where: { id: articleId, businessId },
            include: [
                { model: models_1.db.KnowledgeCategory },
                { model: models_1.db.KnowledgeRevision, as: 'revisions', order: [['version', 'DESC']] }
            ]
        });
    }
    // ── Training Materials ──
    async createTrainingMaterial(businessId, data) {
        return models_1.db.TrainingMaterial.create({ ...data, businessId });
    }
    async listTrainingMaterials(businessId, page, size) {
        return models_1.db.TrainingMaterial.findAndCountAll({
            where: { businessId }, offset: (page - 1) * size, limit: size
        });
    }
    // ── Notifications ──
    async notifyPublicationRequest(businessId, articleId, title) {
        try {
            const managers = await models_1.db.UserRole.findAll({
                include: [{ model: models_1.db.Role, where: { key: 'KNOWLEDGE_MANAGER', businessId: [businessId, null] } }]
            });
            for (const m of managers) {
                await notification_service_1.InternalNotifier.send({
                    businessId, recipientUserId: m.userId, moduleKey: 'brain',
                    type: 'publication_request', title: 'Knowledge Publication Request',
                    message: `Article "${title}" has been submitted for review.`,
                    entityType: 'brain_article', entityId: articleId
                });
            }
        }
        catch (e) { }
    }
}
exports.BrainService = BrainService;
