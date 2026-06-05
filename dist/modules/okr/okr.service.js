"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OKRService = void 0;
const models_1 = require("../../models");
const notification_service_1 = require("../notification/notification.service");
class OKRService {
    // -- Objective --
    async createObjective(businessId, ownerUserId, data) {
        const metadata = this.withProjectLinkMetadata(data);
        return models_1.db.Objective.create({ ...data, metadata, businessId, ownerUserId: ownerUserId || data.ownerUserId });
    }
    async updateObjective(businessId, id, data) {
        const obj = await models_1.db.Objective.findOne({ where: { id, businessId } });
        if (!obj)
            throw new Error("Objective not found");
        return obj.update({ ...data, metadata: this.withProjectLinkMetadata(data, obj.metadata) });
    }
    async getObjective(businessId, id) {
        return models_1.db.Objective.findOne({
            where: { id, businessId },
            include: [
                { model: models_1.db.KeyResult, as: 'keyResults' },
                { model: models_1.db.User, as: 'owner', attributes: ['id', 'email', 'firstName', 'lastName'] },
                { model: models_1.db.Department, attributes: ['id', 'name'] }
            ]
        });
    }
    async listObjectives(businessId, query, page, size) {
        const where = { businessId };
        if (query.level)
            where.level = query.level;
        if (query.ownerUserId)
            where.ownerUserId = query.ownerUserId;
        if (query.departmentId)
            where.departmentId = query.departmentId;
        if (query.periodType)
            where.periodType = query.periodType;
        if (query.status)
            where.status = query.status;
        return models_1.db.Objective.findAndCountAll({
            where,
            offset: (page - 1) * size,
            limit: size,
            include: [{ model: models_1.db.User, as: 'owner', attributes: ['id', 'email'] }, { model: models_1.db.KeyResult, as: 'keyResults' }]
        });
    }
    // -- Key Result --
    async createKeyResult(businessId, objectiveId, data) {
        const metadata = this.withProjectLinkMetadata(data);
        const kr = await models_1.db.KeyResult.create({ ...data, metadata, dataSource: data.taskMetric ? 'projects' : data.dataSource, businessId, objectiveId });
        return kr;
    }
    async updateKeyResult(businessId, id, data) {
        const kr = await models_1.db.KeyResult.findOne({ where: { id, businessId } });
        if (!kr)
            throw new Error("KeyResult not found");
        return kr.update({ ...data, metadata: this.withProjectLinkMetadata(data, kr.metadata), dataSource: data.taskMetric ? 'projects' : data.dataSource ?? kr.dataSource });
    }
    withProjectLinkMetadata(data, current = {}) {
        const projectLinks = {
            ...(current?.projectLinks || {}),
            ...(data.projectId ? { projectId: data.projectId } : {}),
            ...(data.milestoneId ? { milestoneId: data.milestoneId } : {}),
            ...(data.taskMetric ? { taskMetric: data.taskMetric } : {})
        };
        return Object.keys(projectLinks).length ? { ...(current || {}), projectLinks } : (data.metadata ?? current ?? {});
    }
    // -- Progress Update --
    async logProgressUpdate(businessId, updatedByUserId, data) {
        let kr = null;
        if (data.keyResultId) {
            kr = await models_1.db.KeyResult.findOne({ where: { id: data.keyResultId, businessId } });
            if (!kr)
                throw new Error("KeyResult not found");
        }
        const obj = await models_1.db.Objective.findOne({ where: { id: data.objectiveId, businessId } });
        if (!obj)
            throw new Error("Objective not found");
        const progressValue = data.progressValue;
        let progressPercent = 0;
        if (kr && kr.targetValue !== kr.baselineValue) {
            progressPercent = ((progressValue - kr.baselineValue) / (kr.targetValue - kr.baselineValue)) * 100;
            if (progressPercent > 100)
                progressPercent = 100;
            if (progressPercent < 0)
                progressPercent = 0;
        }
        const update = await models_1.db.OKRProgressUpdate.create({
            ...data,
            businessId,
            updatedByUserId,
            progressPercent
        });
        if (kr) {
            await kr.update({ currentValue: progressValue });
            await this.calculateObjectiveProgress(businessId, obj.id);
        }
        // Notify Owner
        if (obj.ownerUserId && obj.ownerUserId !== updatedByUserId) {
            await notification_service_1.InternalNotifier.send({
                businessId, recipientUserId: obj.ownerUserId, moduleKey: 'okr',
                type: 'okr_progress_update', title: 'OKR Progress Update',
                message: `A new progress update was logged for "${obj.title}".`,
                entityType: 'okr_objective', entityId: obj.id
            });
        }
        return update;
    }
    async calculateObjectiveProgress(businessId, objectiveId) {
        const obj = await models_1.db.Objective.findOne({ where: { id: objectiveId, businessId }, include: [{ model: models_1.db.KeyResult, as: 'keyResults' }] });
        if (!obj)
            return;
        if (!obj.keyResults || obj.keyResults.length === 0) {
            return 0; // No KRs
        }
        let totalWeight = 0;
        let weightedProgress = 0;
        for (const kr of obj.keyResults) {
            let pct = 0;
            if (kr.targetValue !== kr.baselineValue) {
                pct = ((kr.currentValue - kr.baselineValue) / (kr.targetValue - kr.baselineValue)) * 100;
            }
            if (pct > 100)
                pct = 100;
            if (pct < 0)
                pct = 0;
            const w = kr.weight || 1;
            totalWeight += w;
            weightedProgress += (pct * w);
        }
        const overallProgress = totalWeight > 0 ? (weightedProgress / totalWeight) : 0;
        // We can store the overallProgress in a metadata field or a new column on Objective, but we'll put it in metadata for now.
        const metadata = obj.metadata || {};
        metadata.calculatedProgress = overallProgress;
        await obj.update({ metadata });
        return overallProgress;
    }
    // -- Evaluation --
    async evaluateObjective(businessId, evaluatedByUserId, data) {
        const obj = await models_1.db.Objective.findOne({ where: { id: data.objectiveId, businessId } });
        if (!obj)
            throw new Error("Objective not found");
        const evaluation = await models_1.db.OKREvaluation.create({
            ...data,
            businessId,
            evaluatedByUserId
        });
        if (data.status) {
            await obj.update({ status: data.status });
        }
        // Notify Owner
        if (obj.ownerUserId && obj.ownerUserId !== evaluatedByUserId) {
            await notification_service_1.InternalNotifier.send({
                businessId, recipientUserId: obj.ownerUserId, moduleKey: 'okr',
                type: 'okr_evaluation', title: 'OKR Evaluation Completed',
                message: `Your objective "${obj.title}" has been evaluated.`,
                entityType: 'okr_objective', entityId: obj.id
            });
        }
        return evaluation;
    }
}
exports.OKRService = OKRService;
