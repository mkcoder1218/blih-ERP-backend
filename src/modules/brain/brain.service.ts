
import { db } from '../../models';
import { InternalNotifier } from '../notification/notification.service';
import { Op } from 'sequelize';

export class BrainService {

  // ── Categories ──
  async createCategory(businessId: string, data: any) {
    return db.KnowledgeCategory.create({ ...data, businessId });
  }

  async listCategories(businessId: string) {
    return db.KnowledgeCategory.findAll({
      where: { businessId },
      include: [{ model: db.KnowledgeCategory, as: 'subcategories' }]
    });
  }

  // ── Articles ──
  async createArticle(businessId: string, authorUserId: string, data: any) {
    const slug = (data.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const article = await db.KnowledgeArticle.create({
      ...data, businessId, authorUserId, slug, version: 1
    });

    // Create initial revision snapshot
    await db.KnowledgeRevision.create({
      businessId, articleId: article.id, revisedByUserId: authorUserId,
      version: 1, changeSummary: 'Initial creation',
      contentSnapshot: { title: article.title, summary: article.summary, content: article.content }
    });

    return article;
  }

  async updateArticle(businessId: string, articleId: string, userId: string, data: any, changeSummary: string) {
    const article = await db.KnowledgeArticle.findOne({ where: { id: articleId, businessId } });
    if (!article) throw new Error('Article not found');

    const newVersion = article.version + 1;
    await article.update({ ...data, version: newVersion });

    // Create revision record
    await db.KnowledgeRevision.create({
      businessId, articleId, revisedByUserId: userId,
      version: newVersion, changeSummary: changeSummary || 'Updated',
      contentSnapshot: { title: article.title, summary: article.summary, content: article.content }
    });

    return article;
  }

  async publishArticle(businessId: string, articleId: string) {
    const article = await db.KnowledgeArticle.findOne({ where: { id: articleId, businessId } });
    if (!article) throw new Error('Article not found');
    await article.update({ status: 'published', publishedAt: new Date() });
    return article;
  }

  async unpublishArticle(businessId: string, articleId: string) {
    const article = await db.KnowledgeArticle.findOne({ where: { id: articleId, businessId } });
    if (!article) throw new Error('Article not found');
    await article.update({ status: 'draft', publishedAt: null });
    return article;
  }

  async listArticles(businessId: string, query: any, page: number, size: number) {
    const where: any = { businessId };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.status) where.status = query.status;
    if (query.visibility) where.visibility = query.visibility;
    if (query.search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${query.search}%` } },
        { summary: { [Op.iLike]: `%${query.search}%` } }
      ];
    }
    return db.KnowledgeArticle.findAndCountAll({
      where, offset: (page - 1) * size, limit: size,
      include: [{ model: db.KnowledgeCategory }],
      order: [['updatedAt', 'DESC']]
    });
  }

  async getArticle(businessId: string, articleId: string) {
    return db.KnowledgeArticle.findOne({
      where: { id: articleId, businessId },
      include: [
        { model: db.KnowledgeCategory },
        { model: db.KnowledgeRevision, as: 'revisions', order: [['version', 'DESC']] }
      ]
    });
  }

  // ── Training Materials ──
  async createTrainingMaterial(businessId: string, data: any) {
    return db.TrainingMaterial.create({ ...data, businessId });
  }

  async listTrainingMaterials(businessId: string, page: number, size: number) {
    return db.TrainingMaterial.findAndCountAll({
      where: { businessId }, offset: (page - 1) * size, limit: size
    });
  }

  // ── Notifications ──
  async notifyPublicationRequest(businessId: string, articleId: string, title: string) {
    try {
      const managers = await db.UserRole.findAll({
        include: [{ model: db.Role, where: { key: 'KNOWLEDGE_MANAGER', businessId: [businessId, null] } }]
      });
      for (const m of managers) {
        await InternalNotifier.send({
          businessId, recipientUserId: m.userId, moduleKey: 'brain',
          type: 'publication_request', title: 'Knowledge Publication Request',
          message: `Article "${title}" has been submitted for review.`,
          entityType: 'brain_article', entityId: articleId
        });
      }
    } catch (e) {}
  }
}
