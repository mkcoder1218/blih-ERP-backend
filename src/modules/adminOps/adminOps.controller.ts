
import type { Request, Response } from 'express';
import { AdminOpsService } from './adminOps.service';
import { AuditLogService } from '../../services/auditLog.service';

export class AdminOpsController {
  private service = new AdminOpsService();

  // Support
  requestSupport = async (req: Request, res: Response) => {
    try {
      const log = await this.service.requestSupportAccess(req.user!.id, req.body.businessId, req.body.reason, req.body.accessType);
      await AuditLogService.log('SUPPORT_ACCESS_REQUESTED', 'support_access_log', String(log.id), null, { reason: req.body.reason }, req);
      res.status(201).json({ supportAccessLog: log });
    } catch(e: any) { res.status(400).json({ message: e.message }); }
  };

  endSupport = async (req: Request, res: Response) => {
    try {
      const log = await this.service.endSupportAccess(req.params.id);
      res.json({ supportAccessLog: log });
    } catch(e: any) { res.status(400).json({ message: e.message }); }
  };

  listSupportLogs = async (req: Request, res: Response) => {
    const logs = await this.service.listSupportLogs(req.user!.businessId);
    res.json({ logs });
  };

  // Impersonation
  startImpersonation = async (req: Request, res: Response) => {
    try {
      if (!req.body.reason) return res.status(400).json({ message: "Reason required for impersonation." });
      const { session, token } = await this.service.startImpersonation(req.user!.id, req.body.targetUserId, req.body.businessId, req.body.reason);
      await AuditLogService.log('IMPERSONATION_STARTED', 'impersonation_session', String(session.id), null, { targetUserId: req.body.targetUserId, reason: req.body.reason }, req);
      res.json({ session, token });
    } catch(e: any) { res.status(400).json({ message: e.message }); }
  };

  endImpersonation = async (req: Request, res: Response) => {
    try {
      const sess = await this.service.endImpersonation(req.params.id);
      res.json({ session: sess });
    } catch(e: any) { res.status(400).json({ message: e.message }); }
  };

  // Health
  checkHealth = async (req: Request, res: Response) => {
     const status = await this.service.logHealthCheck();
     res.json({ systemHealth: status });
  };

  // Jobs
  listJobs = async (req: Request, res: Response) => {
    // SuperAdmin fetches all, BusinessAdmin fetches own
    const bId = req.user!.roles.includes('SUPER_ADMIN') ? undefined : req.user!.businessId;
    const jobs = await this.service.listBackgroundJobs(bId);
    res.json({ backgroundJobs: jobs });
  };
}
