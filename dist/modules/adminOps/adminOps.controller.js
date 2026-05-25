"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminOpsController = void 0;
const adminOps_service_1 = require("./adminOps.service");
const auditLog_service_1 = require("../../services/auditLog.service");
class AdminOpsController {
    constructor() {
        this.service = new adminOps_service_1.AdminOpsService();
        // Support
        this.requestSupport = async (req, res) => {
            try {
                const log = await this.service.requestSupportAccess(req.user.id, req.body.businessId, req.body.reason, req.body.accessType);
                await auditLog_service_1.AuditLogService.log('SUPPORT_ACCESS_REQUESTED', 'support_access_log', String(log.id), null, { reason: req.body.reason }, req);
                res.status(201).json({ supportAccessLog: log });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        this.endSupport = async (req, res) => {
            try {
                const log = await this.service.endSupportAccess(req.params.id);
                res.json({ supportAccessLog: log });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        this.listSupportLogs = async (req, res) => {
            const logs = await this.service.listSupportLogs(req.user.businessId);
            res.json({ logs });
        };
        // Impersonation
        this.startImpersonation = async (req, res) => {
            try {
                if (!req.body.reason)
                    return res.status(400).json({ message: "Reason required for impersonation." });
                const { session, token } = await this.service.startImpersonation(req.user.id, req.body.targetUserId, req.body.businessId, req.body.reason);
                await auditLog_service_1.AuditLogService.log('IMPERSONATION_STARTED', 'impersonation_session', String(session.id), null, { targetUserId: req.body.targetUserId, reason: req.body.reason }, req);
                res.json({ session, token });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        this.endImpersonation = async (req, res) => {
            try {
                const sess = await this.service.endImpersonation(req.params.id);
                res.json({ session: sess });
            }
            catch (e) {
                res.status(400).json({ message: e.message });
            }
        };
        // Health
        this.checkHealth = async (req, res) => {
            const status = await this.service.logHealthCheck();
            res.json({ systemHealth: status });
        };
        // Jobs
        this.listJobs = async (req, res) => {
            // SuperAdmin fetches all, BusinessAdmin fetches own
            const bId = req.user.roles.includes('SUPER_ADMIN') ? undefined : req.user.businessId;
            const jobs = await this.service.listBackgroundJobs(bId);
            res.json({ backgroundJobs: jobs });
        };
    }
}
exports.AdminOpsController = AdminOpsController;
