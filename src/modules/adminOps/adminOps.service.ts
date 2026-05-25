
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
         env.jwtAccessSecret, 
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
