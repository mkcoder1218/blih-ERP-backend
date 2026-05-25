
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
      throw new Error(`Report run failed: ${e.message}`);
    }
  }

  async listReportRuns(businessId: string, reportDefinitionId: string) {
    return db.ReportRun.findAll({ where: { businessId, reportDefinitionId }, order: [['createdAt', 'DESC']], limit: 50 });
  }

  // -- Metric Automation (Business Logic) --
  async generateBasicMetrics(businessId: string) {
    const metricsToCreate: any[] = [];
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
