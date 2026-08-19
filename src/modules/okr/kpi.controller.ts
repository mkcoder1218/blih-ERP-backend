import type { Request, Response, NextFunction } from 'express';
import { kpiService } from './kpi.service';

export class KpiController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const data = await kpiService.listKpis(businessId, req.query);
      res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  }

  async get(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const kpi = await kpiService.getKpi(businessId, req.params.id);
      res.status(200).json({ kpi });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const kpi = await kpiService.createKpi(businessId, userId, req.body);
      res.status(201).json({ kpi });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const kpi = await kpiService.updateKpi(businessId, req.params.id, req.body);
      res.status(200).json({ kpi });
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      await kpiService.deleteKpi(businessId, req.params.id);
      res.status(200).json({ message: "KPI successfully deleted" });
    } catch (error) {
      next(error);
    }
  }

  async manualCheckIn(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const userId = req.user!.id;
      const { value, note } = req.body;
      const data = await kpiService.logKpiManualValue(businessId, userId, req.params.id, value, note);
      res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  }

  async syncAutomatic(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      await kpiService.syncAutomaticKpis(businessId);
      res.status(200).json({ message: "Automatic KPIs refreshed successfully" });
    } catch (error) {
      next(error);
    }
  }

  async trendHistory(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const history = await kpiService.getKpiTrendHistory(businessId, req.params.id);
      res.status(200).json({ history });
    } catch (error) {
      next(error);
    }
  }

  async dashboardSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const businessId = req.user!.businessId;
      const summary = await kpiService.getDashboardSummary(businessId);
      res.status(200).json({ summary });
    } catch (error) {
      next(error);
    }
  }
}

export const kpiController = new KpiController();
