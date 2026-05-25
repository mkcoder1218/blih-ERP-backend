const fs = require('fs');
const path = require('path');

const src = path.join(process.cwd(), 'src');
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const modelsPath = path.join(src, 'models');

// -- ReportDefinition --
fs.writeFileSync(path.join(modelsPath, 'ReportDefinition.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ReportDefinitionModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ReportDefinitionModel => {
  const ReportDefinition = sequelize.define("ReportDefinition", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    moduleKey: { type: dataTypes.STRING(50), allowNull: false }, // hr, crm, finance, okr, projects
    name: { type: dataTypes.STRING(255), allowNull: false },
    key: { type: dataTypes.STRING(100), allowNull: true },
    description: { type: dataTypes.TEXT, allowNull: true },
    queryConfig: { type: dataTypes.JSONB, defaultValue: {} }, // Safe builder config like { entity: 'Lead', action: 'count', groupBy: 'status' }
    filters: { type: dataTypes.JSONB, defaultValue: {} }, // Default predefined filters
    scheduleConfig: { type: dataTypes.JSONB, defaultValue: {} }, // e.g. { frequency: 'weekly', time: '09:00' }
    visibility: { type: dataTypes.STRING(50), defaultValue: "private" }, // private, department, company
    status: { type: dataTypes.STRING(50), defaultValue: "active" } // active, draft, archived
  }, { tableName: "report_definitions", timestamps: true, paranoid: true }) as ReportDefinitionModel;

  ReportDefinition.associate = (models: any) => {
    models.ReportDefinition.belongsTo(models.Business, { foreignKey: "businessId" });
    models.ReportDefinition.hasMany(models.ReportRun, { foreignKey: "reportDefinitionId" });
  };
  return ReportDefinition;
};
`);

// -- ReportRun --
fs.writeFileSync(path.join(modelsPath, 'ReportRun.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ReportRunModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ReportRunModel => {
  const ReportRun = sequelize.define("ReportRun", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    reportDefinitionId: { type: dataTypes.UUID, allowNull: false },
    runByUserId: { type: dataTypes.UUID, allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: "pending" }, // pending, running, completed, error
    filtersUsed: { type: dataTypes.JSONB, defaultValue: {} },
    resultData: { type: dataTypes.JSONB, defaultValue: null }, // Actual JSON snapshot
    errorMessage: { type: dataTypes.TEXT, allowNull: true },
    startedAt: { type: dataTypes.DATE, defaultValue: dataTypes.NOW },
    completedAt: { type: dataTypes.DATE, allowNull: true }
  }, { tableName: "report_runs", timestamps: true }) as ReportRunModel;

  ReportRun.associate = (models: any) => {
    models.ReportRun.belongsTo(models.Business, { foreignKey: "businessId" });
    models.ReportRun.belongsTo(models.ReportDefinition, { foreignKey: "reportDefinitionId" });
    if(models.User) models.ReportRun.belongsTo(models.User, { foreignKey: "runByUserId" });
  };
  return ReportRun;
};
`);

// -- MetricSnapshot --
fs.writeFileSync(path.join(modelsPath, 'MetricSnapshot.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type MetricSnapshotModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): MetricSnapshotModel => {
  const MetricSnapshot = sequelize.define("MetricSnapshot", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    moduleKey: { type: dataTypes.STRING(50), allowNull: false },
    metricKey: { type: dataTypes.STRING(100), allowNull: false },
    metricName: { type: dataTypes.STRING(255), allowNull: false },
    value: { type: dataTypes.FLOAT, allowNull: false },
    unit: { type: dataTypes.STRING(50), allowNull: true },
    dimensions: { type: dataTypes.JSONB, defaultValue: {} },
    periodType: { type: dataTypes.STRING(50), defaultValue: "daily" }, // point_in_time, daily, weekly, monthly
    periodStart: { type: dataTypes.DATE, allowNull: true },
    periodEnd: { type: dataTypes.DATE, allowNull: true }
  }, { tableName: "metric_snapshots", timestamps: true }) as MetricSnapshotModel; // No paranoid needed for timeseries

  MetricSnapshot.associate = (models: any) => {
    models.MetricSnapshot.belongsTo(models.Business, { foreignKey: "businessId" });
  };
  return MetricSnapshot;
};
`);

ensureDir(path.join(src, 'modules', 'reporting'));

// -- Service --
fs.writeFileSync(path.join(src, 'modules', 'reporting', 'reporting.service.ts'), `
import { db } from '../../models';
import { Op } from 'sequelize';

export class ReportingService {

  // -- Report Definitions --
  async createDefinition(businessId: string, data: any) {
    return db.ReportDefinition.create({ ...data, businessId });
  }

  async updateDefinition(businessId: string, id: string, data: any) {
    const def = await db.ReportDefinition.findOne({ where: { id, businessId } });
    if (!def) throw new Error("Report not found");
    return def.update(data);
  }

  async getDefinition(businessId: string, id: string) {
    return db.ReportDefinition.findOne({ where: { id, businessId } });
  }

  async listDefinitions(businessId: string) {
    return db.ReportDefinition.findAll({ where: { businessId } });
  }

  // -- Running Reports --
  async runReport(businessId: string, reportDefinitionId: string, runByUserId: string | null, overrides: any = {}) {
    const def = await db.ReportDefinition.findOne({ where: { id: reportDefinitionId, businessId } });
    if (!def) throw new Error("Report not found");

    const run = await db.ReportRun.create({
      businessId,
      reportDefinitionId,
      runByUserId,
      status: 'running',
      filtersUsed: { ...def.filters, ...overrides }
    });

    try {
      // Safe query builder interpretation based on def.queryConfig
      // Example config: { entity: "Lead", action: "count", groupBy: "status" }
      const qc = def.queryConfig;
      let resultData: any = {};

      if (qc && qc.entity && db[qc.entity]) {
        const Model = db[qc.entity];
        const whereArgs = { businessId, ...run.filtersUsed };
        
        if (qc.action === 'count') {
          if (qc.groupBy) {
            resultData = await Model.findAll({
              where: whereArgs,
              attributes: [qc.groupBy, [db.sequelize.fn('COUNT', '*'), 'totalCount']],
              group: [qc.groupBy]
            });
          } else {
            resultData = { totalCount: await Model.count({ where: whereArgs }) };
          }
        } else if (qc.action === 'find') {
          // Limited to prevent mass extraction
          resultData = await Model.findAll({ where: whereArgs, limit: 100 });
        } else if (qc.action === 'sum' && qc.sumField) {
           resultData = { totalSum: await Model.sum(qc.sumField, { where: whereArgs }) };
        }
      } else {
         resultData = { message: "No execution mapping for given query config" };
      }

      await run.update({
        status: 'completed',
        resultData,
        completedAt: new Date()
      });
      return run;
    } catch (e: any) {
      await run.update({ status: 'error', errorMessage: e.message, completedAt: new Date() });
      throw new Error(\`Report run failed: \${e.message}\`);
    }
  }

  async listReportRuns(businessId: string, reportDefinitionId: string) {
    return db.ReportRun.findAll({ where: { businessId, reportDefinitionId }, order: [['createdAt', 'DESC']], limit: 50 });
  }

  // -- Metric Automation (Business Logic) --
  async generateBasicMetrics(businessId: string) {
    const metricsToCreate = [];
    const now = new Date();

    // CRM
    if (db.Lead) {
      const activeLeads = await db.Lead.count({ where: { businessId, status: { [Op.notIn]: ['lost','closed','won'] } } });
      metricsToCreate.push({ businessId, moduleKey: 'crm', metricKey: 'active_leads', metricName: 'Active Leads', value: activeLeads, periodType: 'point_in_time' });
    }
    
    // Projects
    if (db.ProjectTask) {
      const activeTasks = await db.ProjectTask.count({ where: { businessId, status: { [Op.notIn]: ['completed', 'cancelled'] } } });
      metricsToCreate.push({ businessId, moduleKey: 'projects', metricKey: 'active_tasks', metricName: 'Active Tracking Tasks', value: activeTasks, periodType: 'point_in_time' });
    }

    // Finance
    if (db.Invoice) {
      const unpaidInvoices = await db.Invoice.count({ where: { businessId, status: { [Op.in]: ['sent', 'draft', 'overdue'] } } });
      metricsToCreate.push({ businessId, moduleKey: 'finance', metricKey: 'unpaid_invoices', metricName: 'Unpaid Invoices', value: unpaidInvoices, periodType: 'point_in_time' });
    }

    // Insert all metrics
    const results = await db.MetricSnapshot.bulkCreate(metricsToCreate);
    return results;
  }

  async getMetrics(businessId: string, moduleKey?: string) {
    const where: any = { businessId };
    if (moduleKey) where.moduleKey = moduleKey;
    return db.MetricSnapshot.findAll({ where, order: [['createdAt', 'DESC']], limit: 100 });
  }
}
`);

// -- Controller --
fs.writeFileSync(path.join(src, 'modules', 'reporting', 'reporting.controller.ts'), `
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
`);

// -- Routes --
fs.writeFileSync(path.join(src, 'modules', 'reporting', 'reporting.routes.ts'), `
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { asyncHandler } from '../../utils/asyncHandler';
import { ReportingController } from './reporting.controller';

const router = Router();
const controller = new ReportingController();

router.use(authRequired); // Globally accessible framework module, though role enforcement may happen on route mapping

// Report Definitions
router.post('/definitions', asyncHandler(controller.createDefinition));
router.get('/definitions', asyncHandler(controller.listDefinitions));
router.patch('/definitions/:id', asyncHandler(controller.updateDefinition));

// Running Reports
router.post('/definitions/:id/run', asyncHandler(controller.runReport));
router.get('/definitions/:id/runs', asyncHandler(controller.listReportRuns));

// Metrics
router.post('/metrics/generate', asyncHandler(controller.generateBasicMetrics));
router.get('/metrics', asyncHandler(controller.getMetrics));

export const reportingRoutes = router;
`);

console.log('Reporting Scaffolding Created.');
