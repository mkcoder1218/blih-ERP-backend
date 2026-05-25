const fs = require('fs');
const path = require('path');

const src = path.join(process.cwd(), 'src');
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const modelsPath = path.join(src, 'models');

// -- SupportAccessLog --
fs.writeFileSync(path.join(modelsPath, 'SupportAccessLog.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type SupportAccessLogModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): SupportAccessLogModel => {
  const SupportAccessLog = sequelize.define("SupportAccessLog", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    platformUserId: { type: dataTypes.UUID, allowNull: false },
    businessId: { type: dataTypes.UUID, allowNull: false },
    reason: { type: dataTypes.TEXT, allowNull: false },
    accessType: { type: dataTypes.STRING(50), defaultValue: "read_only" }, // read_only, write
    startedAt: { type: dataTypes.DATE, defaultValue: dataTypes.NOW },
    endedAt: { type: dataTypes.DATE, allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: "active" }, // active, ended, revoked
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "support_access_logs", timestamps: true }) as SupportAccessLogModel;

  SupportAccessLog.associate = (models: any) => {
    if(models.User) SupportAccessLog.belongsTo(models.User, { foreignKey: "platformUserId", as: "platformUser" });
    if(models.Business) SupportAccessLog.belongsTo(models.Business, { foreignKey: "businessId" });
  };
  return SupportAccessLog;
};
`);

// -- AdminImpersonationSession --
fs.writeFileSync(path.join(modelsPath, 'AdminImpersonationSession.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type AdminImpersonationSessionModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): AdminImpersonationSessionModel => {
  const AdminImpersonationSession = sequelize.define("AdminImpersonationSession", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    platformUserId: { type: dataTypes.UUID, allowNull: false },
    targetUserId: { type: dataTypes.UUID, allowNull: false },
    businessId: { type: dataTypes.UUID, allowNull: false },
    reason: { type: dataTypes.TEXT, allowNull: false },
    startedAt: { type: dataTypes.DATE, defaultValue: dataTypes.NOW },
    endedAt: { type: dataTypes.DATE, allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: "active" }, // active, ended
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "admin_impersonation_sessions", timestamps: true }) as AdminImpersonationSessionModel;

  AdminImpersonationSession.associate = (models: any) => {
    if(models.User) {
      AdminImpersonationSession.belongsTo(models.User, { foreignKey: "platformUserId", as: "platformUser" });
      AdminImpersonationSession.belongsTo(models.User, { foreignKey: "targetUserId", as: "targetUser" });
    }
    if(models.Business) AdminImpersonationSession.belongsTo(models.Business, { foreignKey: "businessId" });
  };
  return AdminImpersonationSession;
};
`);

// -- SystemHealthLog --
fs.writeFileSync(path.join(modelsPath, 'SystemHealthLog.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type SystemHealthLogModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): SystemHealthLogModel => {
  const SystemHealthLog = sequelize.define("SystemHealthLog", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    serviceName: { type: dataTypes.STRING(100), allowNull: false }, // database, storage, redis
    status: { type: dataTypes.STRING(50), allowNull: false }, // healthy, degraded, down
    message: { type: dataTypes.TEXT, allowNull: true },
    metadata: { type: dataTypes.JSONB, defaultValue: {} },
    checkedAt: { type: dataTypes.DATE, defaultValue: dataTypes.NOW }
  }, { tableName: "system_health_logs", timestamps: true, updatedAt: false }) as SystemHealthLogModel;
  return SystemHealthLog;
};
`);

// -- BackgroundJobLog --
fs.writeFileSync(path.join(modelsPath, 'BackgroundJobLog.ts'), `
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type BackgroundJobLogModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): BackgroundJobLogModel => {
  const BackgroundJobLog = sequelize.define("BackgroundJobLog", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: true },
    jobName: { type: dataTypes.STRING(255), allowNull: false },
    jobType: { type: dataTypes.STRING(50), allowNull: false }, // report, import, billing
    status: { type: dataTypes.STRING(50), defaultValue: "pending" }, // pending, running, success, failed
    attempts: { type: dataTypes.INTEGER, defaultValue: 0 },
    startedAt: { type: dataTypes.DATE, allowNull: true },
    finishedAt: { type: dataTypes.DATE, allowNull: true },
    errorMessage: { type: dataTypes.TEXT, allowNull: true },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "background_job_logs", timestamps: true }) as BackgroundJobLogModel;

  BackgroundJobLog.associate = (models: any) => {
    if(models.Business) BackgroundJobLog.belongsTo(models.Business, { foreignKey: "businessId" });
  };
  return BackgroundJobLog;
};
`);

ensureDir(path.join(src, 'modules', 'adminOps'));

// -- Service --
fs.writeFileSync(path.join(src, 'modules', 'adminOps', 'adminOps.service.ts'), `
import { db } from '../../models';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

export class AdminOpsService {

  // Support Access
  async requestSupportAccess(platformUserId: string, businessId: string, reason: string, accessType: string = 'read_only') {
     return db.SupportAccessLog.create({ platformUserId, businessId, reason, accessType });
  }

  async endSupportAccess(id: string) {
     const log = await db.SupportAccessLog.findByPk(id);
     if(!log) throw new Error("Log not found");
     return log.update({ status: 'ended', endedAt: new Date() });
  }

  async listSupportLogs(businessId: string) {
     return db.SupportAccessLog.findAll({ where: { businessId }, order: [['createdAt', 'DESC']] });
  }

  // Impersonation
  async startImpersonation(platformUserId: string, targetUserId: string, businessId: string, reason: string) {
     const targetUser = await db.User.findByPk(targetUserId);
     if (!targetUser) throw new Error("Target user not found");
     if (targetUser.roles && targetUser.roles.includes('SUPER_ADMIN')) {
         throw new Error("Cannot impersonate Platform Super Admin");
     }

     const session = await db.AdminImpersonationSession.create({
        platformUserId,
        targetUserId,
        businessId,
        reason
     });

     // Generate Impersonation JWT (extends normal JWT logic but tags impersonatedBy natively)
     const token = jwt.sign(
         { 
           id: targetUser.id, 
           roles: targetUser.roles, 
           businessId: targetUser.businessId,
           impersonatedBy: platformUserId,
           impersonationSessionId: session.id
         }, 
         env.jwtSecret, 
         { expiresIn: '1h' }
     );

     return { session, token };
  }

  async endImpersonation(sessionId: string) {
     const sess = await db.AdminImpersonationSession.findByPk(sessionId);
     if(!sess) throw new Error("Session not found");
     return sess.update({ status: 'ended', endedAt: new Date() });
  }

  // Health Logging
  async logHealthCheck() {
     // Check DB
     try {
       await db.sequelize.authenticate();
       await db.SystemHealthLog.create({ serviceName: 'database', status: 'healthy', checkedAt: new Date() });
     } catch(e: any) {
       await db.SystemHealthLog.create({ serviceName: 'database', status: 'down', message: e.message, checkedAt: new Date() });
     }
     // Normally check storage, redis, etc.
     return db.SystemHealthLog.findAll({ order: [['checkedAt', 'DESC']], limit: 10 });
  }

  // Background Jobs
  async listBackgroundJobs(businessId?: string) {
      const where: any = {};
      if (businessId) where.businessId = businessId;
      return db.BackgroundJobLog.findAll({ where, order: [['createdAt', 'DESC']], limit: 100 });
  }
}
`);

// -- Controller --
fs.writeFileSync(path.join(src, 'modules', 'adminOps', 'adminOps.controller.ts'), `
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
`);

// -- Routes --
fs.writeFileSync(path.join(src, 'modules', 'adminOps', 'adminOps.routes.ts'), `
import { Router } from 'express';
import { authRequired } from '../../middlewares/auth';
import { requireRole } from '../../middlewares/role';
import { asyncHandler } from '../../utils/asyncHandler';
import { AdminOpsController } from './adminOps.controller';

const router = Router();
const controller = new AdminOpsController();

// Support Logs - Admin visible
router.get('/support-logs', authRequired, requireRole('BUSINESS_ADMIN', 'SUPER_ADMIN'), asyncHandler(controller.listSupportLogs));

// System Health - Platform Admins
router.get('/health', authRequired, requireRole('SUPER_ADMIN'), asyncHandler(controller.checkHealth));

// Jobs - Mixed vis
router.get('/jobs', authRequired, requireRole('BUSINESS_ADMIN', 'SUPER_ADMIN'), asyncHandler(controller.listJobs));

// PLATFORM SUPPORT SPECIFIC (Only SUPER_ADMIN)
router.post('/support-access', authRequired, requireRole('SUPER_ADMIN'), asyncHandler(controller.requestSupport));
router.post('/support-access/:id/end', authRequired, requireRole('SUPER_ADMIN'), asyncHandler(controller.endSupport));

router.post('/impersonate', authRequired, requireRole('SUPER_ADMIN'), asyncHandler(controller.startImpersonation));
router.post('/impersonate/:id/end', authRequired, requireRole('SUPER_ADMIN'), asyncHandler(controller.endImpersonation));

export const adminOpsRoutes = router;
`);

ensureDir(path.join(src, 'middlewares'));
fs.writeFileSync(path.join(src, 'middlewares', 'impersonatorCheck.ts'), `
import type { Request, Response, NextFunction } from 'express';
// Augment request namespace inline for demonstration; in a true production app, would extend AuthUser.
export const captureImpersonation = (req: Request, res: Response, next: NextFunction) => {
   // If our JWT payload contained impersonatedBy mapping from adminOps.service
   if (req.user && (req.user as any).impersonatedBy) {
       (req as any).impersonatorMetadata = {
           impersonatedBy: (req.user as any).impersonatedBy,
           sessionId: (req.user as any).impersonationSessionId
       };
   }
   next();
};
`);

console.log('Admin Operations Scaffolding Created.');
