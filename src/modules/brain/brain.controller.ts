
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
