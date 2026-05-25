"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportingService = void 0;
const models_1 = require("../../models");
const sequelize_1 = require("sequelize");
class ReportingService {
    // -- Report Definitions --
    async createDefinition(businessId, data) {
        return models_1.db.ReportDefinition.create({ ...data, businessId });
    }
    async updateDefinition(businessId, id, data) {
        const def = await models_1.db.ReportDefinition.findOne({ where: { id, businessId } });
        if (!def)
            throw new Error("Report not found");
        return def.update(data);
    }
    async getDefinition(businessId, id) {
        return models_1.db.ReportDefinition.findOne({ where: { id, businessId } });
    }
    async listDefinitions(businessId) {
        return models_1.db.ReportDefinition.findAll({ where: { businessId } });
    }
    // -- Running Reports --
    async runReport(businessId, reportDefinitionId, runByUserId, overrides = {}) {
        const def = await models_1.db.ReportDefinition.findOne({ where: { id: reportDefinitionId, businessId } });
        if (!def)
            throw new Error("Report not found");
        const run = await models_1.db.ReportRun.create({
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
            let resultData = {};
            if (qc && qc.entity && models_1.db[qc.entity]) {
                const Model = models_1.db[qc.entity];
                const whereArgs = { businessId, ...run.filtersUsed };
                if (qc.action === 'count') {
                    if (qc.groupBy) {
                        resultData = await Model.findAll({
                            where: whereArgs,
                            attributes: [qc.groupBy, [models_1.db.sequelize.fn('COUNT', '*'), 'totalCount']],
                            group: [qc.groupBy]
                        });
                    }
                    else {
                        resultData = { totalCount: await Model.count({ where: whereArgs }) };
                    }
                }
                else if (qc.action === 'find') {
                    // Limited to prevent mass extraction
                    resultData = await Model.findAll({ where: whereArgs, limit: 100 });
                }
                else if (qc.action === 'sum' && qc.sumField) {
                    resultData = { totalSum: await Model.sum(qc.sumField, { where: whereArgs }) };
                }
            }
            else {
                resultData = { message: "No execution mapping for given query config" };
            }
            await run.update({
                status: 'completed',
                resultData,
                completedAt: new Date()
            });
            return run;
        }
        catch (e) {
            await run.update({ status: 'error', errorMessage: e.message, completedAt: new Date() });
            throw new Error(`Report run failed: ${e.message}`);
        }
    }
    async listReportRuns(businessId, reportDefinitionId) {
        return models_1.db.ReportRun.findAll({ where: { businessId, reportDefinitionId }, order: [['createdAt', 'DESC']], limit: 50 });
    }
    // -- Metric Automation (Business Logic) --
    async generateBasicMetrics(businessId) {
        const metricsToCreate = [];
        const now = new Date();
        // CRM
        if (models_1.db.Lead) {
            const activeLeads = await models_1.db.Lead.count({ where: { businessId, status: { [sequelize_1.Op.notIn]: ['lost', 'closed', 'won'] } } });
            metricsToCreate.push({ businessId, moduleKey: 'crm', metricKey: 'active_leads', metricName: 'Active Leads', value: activeLeads, periodType: 'point_in_time' });
        }
        // Projects
        if (models_1.db.ProjectTask) {
            const activeTasks = await models_1.db.ProjectTask.count({ where: { businessId, status: { [sequelize_1.Op.notIn]: ['completed', 'cancelled'] } } });
            metricsToCreate.push({ businessId, moduleKey: 'projects', metricKey: 'active_tasks', metricName: 'Active Tracking Tasks', value: activeTasks, periodType: 'point_in_time' });
        }
        // Finance
        if (models_1.db.Invoice) {
            const unpaidInvoices = await models_1.db.Invoice.count({ where: { businessId, status: { [sequelize_1.Op.in]: ['sent', 'draft', 'overdue'] } } });
            metricsToCreate.push({ businessId, moduleKey: 'finance', metricKey: 'unpaid_invoices', metricName: 'Unpaid Invoices', value: unpaidInvoices, periodType: 'point_in_time' });
        }
        // Insert all metrics
        const results = await models_1.db.MetricSnapshot.bulkCreate(metricsToCreate);
        return results;
    }
    async getMetrics(businessId, moduleKey) {
        const where = { businessId };
        if (moduleKey)
            where.moduleKey = moduleKey;
        return models_1.db.MetricSnapshot.findAll({ where, order: [['createdAt', 'DESC']], limit: 100 });
    }
}
exports.ReportingService = ReportingService;
