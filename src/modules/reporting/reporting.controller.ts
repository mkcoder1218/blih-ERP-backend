
import type { Request, Response } from 'express';
import { ReportingService } from './reporting.service';
import { AuditLogService } from '../../services/auditLog.service';

export class ReportingController {
  private service = new ReportingService();

  createDefinition = async (req: Request, res: Response) => {
    try {
      const rpt = await this.service.createDefinition(req.user!.businessId, req.body);
      await AuditLogService.log('CREATE_REPORT_DEF', 'report_definition', String(rpt.id), null, rpt, req);
      res.status(201).json({ reportDefinition: rpt });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };

  updateDefinition = async (req: Request, res: Response) => {
    try {
      const rpt = await this.service.updateDefinition(req.user!.businessId, req.params.id, req.body);
      await AuditLogService.log('UPDATE_REPORT_DEF', 'report_definition', String(rpt.id), null, req.body, req);
      res.json({ reportDefinition: rpt });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  };

  listDefinitions = async (req: Request, res: Response) => {
    const rpts = await this.service.listDefinitions(req.user!.businessId);
    res.json({ reportDefinitions: rpts });
  };

  runReport = async (req: Request, res: Response) => {
    try {
      const run = await this.service.runReport(req.user!.businessId, req.params.id, req.user!.id, req.body.overrides);
      await AuditLogService.log('RUN_REPORT', 'report_run', String(run.id), null, { definitionId: req.params.id }, req);
      res.json({ reportRun: run });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  };

  listReportRuns = async (req: Request, res: Response) => {
    const runs = await this.service.listReportRuns(req.user!.businessId, req.params.id);
    res.json({ reportRuns: runs });
  };

  generateBasicMetrics = async (req: Request, res: Response) => {
    try {
      const metrics = await this.service.generateBasicMetrics(req.user!.businessId);
      res.status(201).json({ message: "Metrics generated", count: metrics.length });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  };

  getMetrics = async (req: Request, res: Response) => {
    const metrics = await this.service.getMetrics(req.user!.businessId, req.query.moduleKey as string);
    res.json({ metrics });
  };
}
