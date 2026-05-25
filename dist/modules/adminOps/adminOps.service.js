"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminOpsService = void 0;
const models_1 = require("../../models");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("../../config/env");
class AdminOpsService {
    // Support Access
    async requestSupportAccess(platformUserId, businessId, reason, accessType = 'read_only') {
        return models_1.db.SupportAccessLog.create({ platformUserId, businessId, reason, accessType });
    }
    async endSupportAccess(id) {
        const log = await models_1.db.SupportAccessLog.findByPk(id);
        if (!log)
            throw new Error("Log not found");
        return log.update({ status: 'ended', endedAt: new Date() });
    }
    async listSupportLogs(businessId) {
        return models_1.db.SupportAccessLog.findAll({ where: { businessId }, order: [['createdAt', 'DESC']] });
    }
    // Impersonation
    async startImpersonation(platformUserId, targetUserId, businessId, reason) {
        const targetUser = await models_1.db.User.findByPk(targetUserId);
        if (!targetUser)
            throw new Error("Target user not found");
        if (targetUser.roles && targetUser.roles.includes('SUPER_ADMIN')) {
            throw new Error("Cannot impersonate Platform Super Admin");
        }
        const session = await models_1.db.AdminImpersonationSession.create({
            platformUserId,
            targetUserId,
            businessId,
            reason
        });
        // Generate Impersonation JWT (extends normal JWT logic but tags impersonatedBy natively)
        const token = jsonwebtoken_1.default.sign({
            id: targetUser.id,
            roles: targetUser.roles,
            businessId: targetUser.businessId,
            impersonatedBy: platformUserId,
            impersonationSessionId: session.id
        }, env_1.env.jwtAccessSecret, { expiresIn: '1h' });
        return { session, token };
    }
    async endImpersonation(sessionId) {
        const sess = await models_1.db.AdminImpersonationSession.findByPk(sessionId);
        if (!sess)
            throw new Error("Session not found");
        return sess.update({ status: 'ended', endedAt: new Date() });
    }
    // Health Logging
    async logHealthCheck() {
        // Check DB
        try {
            await models_1.db.sequelize.authenticate();
            await models_1.db.SystemHealthLog.create({ serviceName: 'database', status: 'healthy', checkedAt: new Date() });
        }
        catch (e) {
            await models_1.db.SystemHealthLog.create({ serviceName: 'database', status: 'down', message: e.message, checkedAt: new Date() });
        }
        // Normally check storage, redis, etc.
        return models_1.db.SystemHealthLog.findAll({ order: [['checkedAt', 'DESC']], limit: 10 });
    }
    // Background Jobs
    async listBackgroundJobs(businessId) {
        const where = {};
        if (businessId)
            where.businessId = businessId;
        return models_1.db.BackgroundJobLog.findAll({ where, order: [['createdAt', 'DESC']], limit: 100 });
    }
}
exports.AdminOpsService = AdminOpsService;
