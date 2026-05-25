
import { db } from '../../models';
import { InternalNotifier } from '../notification/notification.service';

export class OKRService {

  // -- Objective --
  async createObjective(businessId: string, ownerUserId: string | null, data: any) {
    return db.Objective.create({ ...data, businessId, ownerUserId: ownerUserId || data.ownerUserId });
  }

  async updateObjective(businessId: string, id: string, data: any) {
    const obj = await db.Objective.findOne({ where: { id, businessId } });
    if (!obj) throw new Error("Objective not found");
    return obj.update(data);
  }

  async getObjective(businessId: string, id: string) {
    return db.Objective.findOne({
      where: { id, businessId },
      include: [
        { model: db.KeyResult, as: 'keyResults' },
        { model: db.User, as: 'owner', attributes: ['id', 'email', 'firstName', 'lastName'] },
        { model: db.Department, attributes: ['id', 'name'] }
      ]
    });
  }

  async listObjectives(businessId: string, query: any, page: number, size: number) {
    const where: any = { businessId };
    if (query.level) where.level = query.level;
    if (query.ownerUserId) where.ownerUserId = query.ownerUserId;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.periodType) where.periodType = query.periodType;
    if (query.status) where.status = query.status;

    return db.Objective.findAndCountAll({
      where,
      offset: (page - 1) * size,
      limit: size,
      include: [{ model: db.User, as: 'owner', attributes: ['id', 'email'] }, { model: db.KeyResult, as: 'keyResults' }]
    });
  }

  // -- Key Result --
  async createKeyResult(businessId: string, objectiveId: string, data: any) {
    const kr = await db.KeyResult.create({ ...data, businessId, objectiveId });
    return kr;
  }

  async updateKeyResult(businessId: string, id: string, data: any) {
    const kr = await db.KeyResult.findOne({ where: { id, businessId } });
    if (!kr) throw new Error("KeyResult not found");
    return kr.update(data);
  }

  // -- Progress Update --
  async logProgressUpdate(businessId: string, updatedByUserId: string, data: any) {
    let kr: any = null;
    if (data.keyResultId) {
      kr = await db.KeyResult.findOne({ where: { id: data.keyResultId, businessId } });
      if (!kr) throw new Error("KeyResult not found");
    }

    const obj = await db.Objective.findOne({ where: { id: data.objectiveId, businessId } });
    if (!obj) throw new Error("Objective not found");

    const progressValue = data.progressValue;
    let progressPercent = 0;
    if (kr && kr.targetValue !== kr.baselineValue) {
      progressPercent = ((progressValue - kr.baselineValue) / (kr.targetValue - kr.baselineValue)) * 100;
      if (progressPercent > 100) progressPercent = 100;
      if (progressPercent < 0) progressPercent = 0;
    }

    const update = await db.OKRProgressUpdate.create({
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
      await InternalNotifier.send({
        businessId, recipientUserId: obj.ownerUserId, moduleKey: 'okr',
        type: 'okr_progress_update', title: 'OKR Progress Update',
        message: `A new progress update was logged for "${obj.title}".`,
        entityType: 'okr_objective', entityId: obj.id
      });
    }

    return update;
  }

  async calculateObjectiveProgress(businessId: string, objectiveId: string) {
    const obj = await db.Objective.findOne({ where: { id: objectiveId, businessId }, include: [{ model: db.KeyResult, as: 'keyResults' }] });
    if (!obj) return;

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
      if (pct > 100) pct = 100;
      if (pct < 0) pct = 0;

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
  async evaluateObjective(businessId: string, evaluatedByUserId: string, data: any) {
    const obj = await db.Objective.findOne({ where: { id: data.objectiveId, businessId } });
    if (!obj) throw new Error("Objective not found");

    const evaluation = await db.OKREvaluation.create({
      ...data,
      businessId,
      evaluatedByUserId
    });

    if (data.status) {
      await obj.update({ status: data.status });
    }

    // Notify Owner
    if (obj.ownerUserId && obj.ownerUserId !== evaluatedByUserId) {
      await InternalNotifier.send({
        businessId, recipientUserId: obj.ownerUserId, moduleKey: 'okr',
        type: 'okr_evaluation', title: 'OKR Evaluation Completed',
        message: `Your objective "${obj.title}" has been evaluated.`,
        entityType: 'okr_objective', entityId: obj.id
      });
    }

    return evaluation;
  }

}
