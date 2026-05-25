"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportingController = void 0;
const reporting_service_1 = require("./reporting.service");
const auditLog_service_1 = require("../../services/auditLog.service");
class ReportingController {
    constructor() {
        this.service = new reporting_service_1.ReportingService();
        this.createDefinition = async (req, res) => {
            try {
                const rpt = await this.service.createDefinition(req.user.businessId, req.body);
                await auditLog_service_1.AuditLogService.log('CREATE_REPORT_DEF', 'report_definition', String(rpt.id), null, rpt, req);
                res.status(201).json({ reportDefinition: rpt });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        this.updateDefinition = async (req, res) => {
            try {
                const rpt = await this.service.updateDefinition(req.user.businessId, req.params.id, req.body);
                await auditLog_service_1.AuditLogService.log('UPDATE_REPORT_DEF', 'report_definition', String(rpt.id), null, req.body, req);
                res.json({ reportDefinition: rpt });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        this.listDefinitions = async (req, res) => {
            const rpts = await this.service.listDefinitions(req.user.businessId);
            res.json({ reportDefinitions: rpts });
        };
        this.runReport = async (req, res) => {
            try {
                const run = await this.service.runReport(req.user.businessId, req.params.id, req.user.id, req.body.overrides);
                await auditLog_service_1.AuditLogService.log('RUN_REPORT', 'report_run', String(run.id), null, { definitionId: req.params.id }, req);
                res.json({ reportRun: run });
            }
            catch (e) {
                res.status(500).json({ message: e.message });
            }
        };
        this.listReportRuns = async (req, res) => {
            const runs = await this.service.listReportRuns(req.user.businessId, req.params.id);
            res.json({ reportRuns: runs });
        };
        this.generateBasicMetrics = async (req, res) => {
            try {
                const metrics = await this.service.generateBasicMetrics(req.user.businessId);
                res.status(201).json({ message: "Metrics generated", count: metrics.length });
            }
            catch (e) {
                res.status(500).json({ message: e.message });
            }
        };
        this.getMetrics = async (req, res) => {
            const metrics = await this.service.getMetrics(req.user.businessId, req.query.moduleKey);
            res.json({ metrics });
        };
    }
}
exports.ReportingController = ReportingController;
