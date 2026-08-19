import type { Request, Response } from 'express';
import { BrainService } from './brain.service';
import { AuditLogService } from '../../services/auditLog.service';

export class BrainController {
  private service = new BrainService();

  // ── Categories ──

  createCategory = async (req: Request, res: Response) => {
    const category = await this.service.createCategory(req.user!.businessId, req.body);
    await AuditLogService.log('CREATE_BRAIN_CATEGORY', 'brain_category', String(category.id), null, category, req);
    res.status(201).json({ category });
  };

  listCategories = async (req: Request, res: Response) => {
    const result = await this.service.listCategories(req.user!.businessId, req.query, req.user!.permissions || []);
    res.json(result);
  };

  getCategory = async (req: Request, res: Response) => {
    const category = await this.service.getCategory(req.user!.businessId, req.params.id);
    res.json({ category });
  };

  updateCategory = async (req: Request, res: Response) => {
    const before = await this.service.getCategory(req.user!.businessId, req.params.id);
    const category = await this.service.updateCategory(req.user!.businessId, req.params.id, req.body);
    await AuditLogService.log('UPDATE_BRAIN_CATEGORY', 'brain_category', String(category.id), before, category, req);
    res.json({ category });
  };

  deleteCategory = async (req: Request, res: Response) => {
    const before = await this.service.getCategory(req.user!.businessId, req.params.id);
    const result = await this.service.deleteCategory(req.user!.businessId, req.params.id);
    await AuditLogService.log('DELETE_BRAIN_CATEGORY', 'brain_category', req.params.id, before, null, req);
    res.json(result);
  };

  restoreCategory = async (req: Request, res: Response) => {
    const category = await this.service.restoreCategory(req.user!.businessId, req.params.id);
    await AuditLogService.log('RESTORE_BRAIN_CATEGORY', 'brain_category', String(category.id), null, category, req);
    res.json({ category });
  };

  // ── Articles ──

  createArticle = async (req: Request, res: Response) => {
    const article = await this.service.createArticle(req.user!.businessId, req.user!.id, req.body);
    await AuditLogService.log('CREATE_BRAIN_ARTICLE', 'brain_article', String(article.id), null, article, req);
    res.status(201).json({ article });
  };

  listArticles = async (req: Request, res: Response) => {
    const result = await this.service.listArticles(req.user!.businessId, req.user!, req.query);
    res.json(result);
  };

  getArticle = async (req: Request, res: Response) => {
    const article = await this.service.getArticle(req.user!.businessId, req.params.id, req.user!);
    res.json({ article });
  };

  updateArticle = async (req: Request, res: Response) => {
    const { changeSummary, ...data } = req.body;
    const before = await this.service.getArticle(req.user!.businessId, req.params.id, req.user!);
    const article = await this.service.updateArticle(req.user!.businessId, req.params.id, req.user!, data, changeSummary);
    await AuditLogService.log('UPDATE_BRAIN_ARTICLE', 'brain_article', String(article.id), before, { article, changeSummary }, req);
    res.json({ article });
  };

  deleteArticle = async (req: Request, res: Response) => {
    const before = await this.service.getArticle(req.user!.businessId, req.params.id, req.user!);
    const result = await this.service.deleteArticle(req.user!.businessId, req.params.id, req.user!);
    await AuditLogService.log('DELETE_BRAIN_ARTICLE', 'brain_article', req.params.id, before, null, req);
    res.json(result);
  };

  restoreArticle = async (req: Request, res: Response) => {
    const article = await this.service.restoreArticle(req.user!.businessId, req.params.id, req.user!);
    await AuditLogService.log('RESTORE_BRAIN_ARTICLE', 'brain_article', String(article.id), null, article, req);
    res.json({ article });
  };

  // ── Workflow Actions ──

  submitForReview = async (req: Request, res: Response) => {
    const before = await this.service.getArticle(req.user!.businessId, req.params.id, req.user!);
    const article = await this.service.submitForReview(req.user!.businessId, req.params.id, req.user!);
    await AuditLogService.log('SUBMIT_BRAIN_ARTICLE_REVIEW', 'brain_article', String(article.id), before, article, req);
    res.json({ article });
  };

  approveArticle = async (req: Request, res: Response) => {
    const before = await this.service.getArticle(req.user!.businessId, req.params.id, req.user!);
    const article = await this.service.approveArticle(req.user!.businessId, req.params.id, req.user!);
    await AuditLogService.log('APPROVE_BRAIN_ARTICLE', 'brain_article', String(article.id), before, article, req);
    res.json({ article });
  };

  requestChanges = async (req: Request, res: Response) => {
    const { comment } = req.body;
    const before = await this.service.getArticle(req.user!.businessId, req.params.id, req.user!);
    const article = await this.service.requestChanges(req.user!.businessId, req.params.id, req.user!, comment);
    await AuditLogService.log('REQUEST_BRAIN_ARTICLE_CHANGES', 'brain_article', String(article.id), before, { article, comment }, req);
    res.json({ article });
  };

  publishArticle = async (req: Request, res: Response) => {
    const before = await this.service.getArticle(req.user!.businessId, req.params.id, req.user!);
    const article = await this.service.publishArticle(req.user!.businessId, req.params.id, req.user!);
    await AuditLogService.log('PUBLISH_BRAIN_ARTICLE', 'brain_article', String(article.id), before, article, req);
    res.json({ article });
  };

  unpublishArticle = async (req: Request, res: Response) => {
    const before = await this.service.getArticle(req.user!.businessId, req.params.id, req.user!);
    const article = await this.service.unpublishArticle(req.user!.businessId, req.params.id, req.user!);
    await AuditLogService.log('UNPUBLISH_BRAIN_ARTICLE', 'brain_article', String(article.id), before, { article, oldPublishedAt: before.publishedAt, oldPublishedByUserId: before.publishedByUserId }, req);
    res.json({ article });
  };

  archiveArticle = async (req: Request, res: Response) => {
    const before = await this.service.getArticle(req.user!.businessId, req.params.id, req.user!);
    const article = await this.service.archiveArticle(req.user!.businessId, req.params.id, req.user!);
    await AuditLogService.log('ARCHIVE_BRAIN_ARTICLE', 'brain_article', String(article.id), before, article, req);
    res.json({ article });
  };

  // ── Revisions ──

  listRevisions = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    const result = await this.service.listRevisions(req.user!.businessId, req.params.id, req.user!, page, size);
    res.json(result);
  };

  getRevision = async (req: Request, res: Response) => {
    const revision = await this.service.getRevision(req.user!.businessId, req.params.id, req.params.revisionId, req.user!);
    res.json({ revision });
  };

  restoreRevision = async (req: Request, res: Response) => {
    const article = await this.service.restoreRevision(req.user!.businessId, req.params.id, req.params.revisionId, req.user!);
    await AuditLogService.log('RESTORE_BRAIN_ARTICLE_REVISION', 'brain_article', String(article.id), null, { article, restoredFromRevisionId: req.params.revisionId }, req);
    res.json({ article });
  };

  // ── Training Materials ──

  createTrainingMaterial = async (req: Request, res: Response) => {
    const trainingMaterial = await this.service.createTrainingMaterial(req.user!.businessId, req.body);
    await AuditLogService.log('CREATE_TRAINING_MATERIAL', 'brain_training', String(trainingMaterial.id), null, trainingMaterial, req);
    res.status(201).json({ trainingMaterial });
  };

  updateTrainingMaterial = async (req: Request, res: Response) => {
    const trainingMaterial = await this.service.updateTrainingMaterial(req.user!.businessId, req.params.id, req.body);
    await AuditLogService.log('UPDATE_TRAINING_MATERIAL', 'brain_training', String(trainingMaterial.id), null, trainingMaterial, req);
    res.json({ trainingMaterial });
  };

  deleteTrainingMaterial = async (req: Request, res: Response) => {
    const result = await this.service.deleteTrainingMaterial(req.user!.businessId, req.params.id);
    await AuditLogService.log('DELETE_TRAINING_MATERIAL', 'brain_training', req.params.id, null, null, req);
    res.json(result);
  };

  listTrainingMaterials = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    const result = await this.service.listTrainingMaterials(req.user!.businessId, page, size);
    res.json(result);
  };
}
