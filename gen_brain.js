const fs = require('fs');
const path = require('path');

const src = path.join(process.cwd(), 'src');
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const modelsPath = path.join(src, 'models');

// ── KnowledgeCategory ──
fs.writeFileSync(path.join(modelsPath, 'KnowledgeCategory.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type KnowledgeCategoryModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): KnowledgeCategoryModel => {
  const KnowledgeCategory = sequelize.define("KnowledgeCategory", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    parentCategoryId: { type: dataTypes.UUID, allowNull: true },
    name: { type: dataTypes.STRING(255), allowNull: false },
    key: { type: dataTypes.STRING(120), allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: true },
    visibility: { type: dataTypes.STRING(50), defaultValue: "internal" }, // internal, department, public
    status: { type: dataTypes.STRING(50), defaultValue: "active" }
  }, { tableName: "brain_categories", timestamps: true, paranoid: true }) as KnowledgeCategoryModel;

  KnowledgeCategory.associate = (models: any) => {
    models.KnowledgeCategory.belongsTo(models.Business, { foreignKey: "businessId" });
    models.KnowledgeCategory.belongsTo(models.KnowledgeCategory, { foreignKey: "parentCategoryId", as: "parentCategory" });
    models.KnowledgeCategory.hasMany(models.KnowledgeCategory, { foreignKey: "parentCategoryId", as: "subcategories" });
    models.KnowledgeCategory.hasMany(models.KnowledgeArticle, { foreignKey: "categoryId" });
    models.KnowledgeCategory.hasMany(models.TrainingMaterial, { foreignKey: "categoryId" });
  };
  return KnowledgeCategory;
};
`);

// ── KnowledgeArticle ──
fs.writeFileSync(path.join(modelsPath, 'KnowledgeArticle.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type KnowledgeArticleModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): KnowledgeArticleModel => {
  const KnowledgeArticle = sequelize.define("KnowledgeArticle", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    categoryId: { type: dataTypes.UUID, allowNull: true },
    authorUserId: { type: dataTypes.UUID, allowNull: false },
    title: { type: dataTypes.STRING(500), allowNull: false },
    slug: { type: dataTypes.STRING(500), allowNull: false },
    summary: { type: dataTypes.TEXT, allowNull: true },
    content: { type: dataTypes.TEXT, allowNull: true },
    visibility: { type: dataTypes.STRING(50), defaultValue: "internal" }, // internal, department, public
    status: { type: dataTypes.STRING(50), defaultValue: "draft" }, // draft, in_review, published, archived
    version: { type: dataTypes.INTEGER, defaultValue: 1 },
    publishedAt: { type: dataTypes.DATE, allowNull: true },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "brain_articles", timestamps: true, paranoid: true }) as KnowledgeArticleModel;

  KnowledgeArticle.associate = (models: any) => {
    models.KnowledgeArticle.belongsTo(models.Business, { foreignKey: "businessId" });
    models.KnowledgeArticle.belongsTo(models.KnowledgeCategory, { foreignKey: "categoryId" });
    if(models.User) models.KnowledgeArticle.belongsTo(models.User, { foreignKey: "authorUserId", as: "author" });
    models.KnowledgeArticle.hasMany(models.KnowledgeRevision, { foreignKey: "articleId", as: "revisions" });
  };
  return KnowledgeArticle;
};
`);

// ── KnowledgeRevision ──
fs.writeFileSync(path.join(modelsPath, 'KnowledgeRevision.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type KnowledgeRevisionModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): KnowledgeRevisionModel => {
  const KnowledgeRevision = sequelize.define("KnowledgeRevision", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    articleId: { type: dataTypes.UUID, allowNull: false },
    revisedByUserId: { type: dataTypes.UUID, allowNull: false },
    version: { type: dataTypes.INTEGER, allowNull: false },
    changeSummary: { type: dataTypes.TEXT, allowNull: true },
    contentSnapshot: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "brain_revisions", timestamps: true, updatedAt: false }) as KnowledgeRevisionModel;

  KnowledgeRevision.associate = (models: any) => {
    models.KnowledgeRevision.belongsTo(models.Business, { foreignKey: "businessId" });
    models.KnowledgeRevision.belongsTo(models.KnowledgeArticle, { foreignKey: "articleId" });
    if(models.User) models.KnowledgeRevision.belongsTo(models.User, { foreignKey: "revisedByUserId", as: "revisedBy" });
  };
  return KnowledgeRevision;
};
`);

// ── TrainingMaterial ──
fs.writeFileSync(path.join(modelsPath, 'TrainingMaterial.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type TrainingMaterialModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): TrainingMaterialModel => {
  const TrainingMaterial = sequelize.define("TrainingMaterial", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    categoryId: { type: dataTypes.UUID, allowNull: true },
    title: { type: dataTypes.STRING(500), allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: true },
    materialType: { type: dataTypes.STRING(50), defaultValue: "document" }, // document, video, presentation, link
    fileAssetId: { type: dataTypes.UUID, allowNull: true },
    url: { type: dataTypes.STRING(2048), allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: "active" },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "brain_training_materials", timestamps: true, paranoid: true }) as TrainingMaterialModel;

  TrainingMaterial.associate = (models: any) => {
    models.TrainingMaterial.belongsTo(models.Business, { foreignKey: "businessId" });
    models.TrainingMaterial.belongsTo(models.KnowledgeCategory, { foreignKey: "categoryId" });
    if(models.FileAsset) models.TrainingMaterial.belongsTo(models.FileAsset, { foreignKey: "fileAssetId" });
  };
  return TrainingMaterial;
};
`);

// ── Service ──
ensureDir(path.join(src, 'modules', 'brain'));

fs.writeFileSync(path.join(src, 'modules', 'brain', 'brain.service.ts'), `
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
        { title: { [Op.iLike]: \`%\${query.search}%\` } },
        { summary: { [Op.iLike]: \`%\${query.search}%\` } }
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
          message: \`Article "\${title}" has been submitted for review.\`,
          entityType: 'brain_article', entityId: articleId
        });
      }
    } catch (e) {}
  }
}
`);

// ── Controller ──
fs.writeFileSync(path.join(src, 'modules', 'brain', 'brain.controller.ts'), `
import type { Request, Response } from 'express';
import { BrainService } from './brain.service';
import { AuditLogService } from '../../services/auditLog.service';

export class BrainController {
  private service = new BrainService();

  // Categories
  createCategory = async (req: Request, res: Response) => {
    try {
      const cat = await this.service.createCategory(req.user!.businessId, req.body);
      await AuditLogService.log('CREATE_KB_CATEGORY', 'brain_category', String(cat.id), null, cat, req);
      res.status(201).json({ category: cat });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };

  listCategories = async (req: Request, res: Response) => {
    res.json(await this.service.listCategories(req.user!.businessId));
  };

  // Articles
  createArticle = async (req: Request, res: Response) => {
    try {
      const article = await this.service.createArticle(req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log('CREATE_KB_ARTICLE', 'brain_article', String(article.id), null, article, req);
      res.status(201).json({ article });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };

  updateArticle = async (req: Request, res: Response) => {
    try {
      const { changeSummary, ...data } = req.body;
      const article = await this.service.updateArticle(req.user!.businessId, req.params.id, req.user!.id, data, changeSummary);
      await AuditLogService.log('UPDATE_KB_ARTICLE', 'brain_article', String(article.id), null, { changeSummary }, req);
      res.json({ article });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };

  publishArticle = async (req: Request, res: Response) => {
    try {
      const article = await this.service.publishArticle(req.user!.businessId, req.params.id);
      await AuditLogService.log('PUBLISH_KB_ARTICLE', 'brain_article', String(article.id), null, null, req);
      res.json({ article });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };

  unpublishArticle = async (req: Request, res: Response) => {
    try {
      const article = await this.service.unpublishArticle(req.user!.businessId, req.params.id);
      await AuditLogService.log('UNPUBLISH_KB_ARTICLE', 'brain_article', String(article.id), null, null, req);
      res.json({ article });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };

  submitForReview = async (req: Request, res: Response) => {
    try {
      const article = await this.service.getArticle(req.user!.businessId, req.params.id);
      if (!article) return res.status(404).json({ message: 'Article not found' });
      await article.update({ status: 'in_review' });
      await this.service.notifyPublicationRequest(req.user!.businessId, article.id, article.title);
      await AuditLogService.log('SUBMIT_KB_REVIEW', 'brain_article', String(article.id), null, null, req);
      res.json({ article });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };

  getArticle = async (req: Request, res: Response) => {
    const article = await this.service.getArticle(req.user!.businessId, req.params.id);
    if (!article) return res.status(404).json({ message: 'Article not found' });
    res.json({ article });
  };

  listArticles = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    res.json(await this.service.listArticles(req.user!.businessId, req.query, page, size));
  };

  // Training Materials
  createTrainingMaterial = async (req: Request, res: Response) => {
    try {
      const tm = await this.service.createTrainingMaterial(req.user!.businessId, req.body);
      await AuditLogService.log('CREATE_TRAINING_MATERIAL', 'brain_training', String(tm.id), null, tm, req);
      res.status(201).json({ trainingMaterial: tm });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };

  listTrainingMaterials = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    res.json(await this.service.listTrainingMaterials(req.user!.businessId, page, size));
  };
}
`);

// ── Routes ──
fs.writeFileSync(path.join(src, 'modules', 'brain', 'brain.routes.ts'), `
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { requireActiveModule } from '../../middlewares/module';
import { asyncHandler } from '../../utils/asyncHandler';
import { BrainController } from './brain.controller';

const router = Router();
const controller = new BrainController();

router.use(authRequired, requireActiveModule('brain'));

// Categories
router.post('/categories', requireRole('KNOWLEDGE_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.createCategory));
router.get('/categories', asyncHandler(controller.listCategories));

// Articles
router.post('/articles', asyncHandler(controller.createArticle));
router.get('/articles', asyncHandler(controller.listArticles));
router.get('/articles/:id', asyncHandler(controller.getArticle));
router.patch('/articles/:id', asyncHandler(controller.updateArticle));
router.patch('/articles/:id/publish', requireRole('KNOWLEDGE_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.publishArticle));
router.patch('/articles/:id/unpublish', requireRole('KNOWLEDGE_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.unpublishArticle));
router.patch('/articles/:id/submit-review', asyncHandler(controller.submitForReview));

// Training Materials
router.post('/training', requireRole('KNOWLEDGE_MANAGER', 'BUSINESS_ADMIN'), asyncHandler(controller.createTrainingMaterial));
router.get('/training', asyncHandler(controller.listTrainingMaterials));

export const brainRoutes = router;
`);

console.log('Brain Scaffolding Created.');
