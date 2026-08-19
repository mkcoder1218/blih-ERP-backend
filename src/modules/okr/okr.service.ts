import { db } from '../../models';
import { metricCalculatorRegistry, PREDEFINED_METRICS } from './metricCalculatorRegistry';
import { InternalNotifier } from '../notification/notification.service';
import { Op } from 'sequelize';

export class OKRService {

  async seedMetricTemplatesIfEmpty() {
    const count = await db.OkrMetricTemplate.count();
    if (count === 0) {
      await db.OkrMetricTemplate.bulkCreate(PREDEFINED_METRICS);
    }
  }

  // Calculate progress percentage of a Key Result
  calculateKrProgress(kr: any): number {
    const baseline = kr.baselineValue || 0;
    const target = kr.targetValue;
    const current = kr.currentValue || 0;

    if (baseline === target) return 100;

    const isLowerBetter = kr.direction === 'LOWER_IS_BETTER';

    if (isLowerBetter) {
      if (current <= target) return 100;
      if (current >= baseline) return 0;
      return Math.round(((baseline - current) / (baseline - target)) * 100);
    } else {
      if (current >= target) return 100;
      if (current <= baseline) return 0;
      return Math.round(((current - baseline) / (target - baseline)) * 100);
    }
  }

  // Recalculate health status of a Key Result
  calculateKrHealth(progress: number): string {
    if (progress >= 70) return 'ON_TRACK';
    if (progress >= 40) return 'AT_RISK';
    return 'OFF_TRACK';
  }

  // Calculate baseline parameters dynamically for AUTOMATIC Key Results
  async computeAutomaticBaselineAndCurrent(businessId: string, objective: any, krData: any) {
    const start = new Date(objective.periodStart);
    const end = new Date(objective.periodEnd);
    const durationMs = end.getTime() - start.getTime();

    // Baseline period is a historical window matching the OKR duration ending at periodStart
    const baselineEnd = start;
    const baselineStart = new Date(baselineEnd.getTime() - durationMs);

    const baselinePeriodStart = baselineStart.toISOString().split('T')[0];
    const baselinePeriodEnd = baselineEnd.toISOString().split('T')[0];

    const ctx = {
      businessId,
      ownerType: objective.ownerType,
      ownerId: objective.ownerId,
      startDate: baselinePeriodStart,
      endDate: baselinePeriodEnd
    };

    const currentCtx = {
      businessId,
      ownerType: objective.ownerType,
      ownerId: objective.ownerId,
      startDate: objective.periodStart,
      endDate: objective.periodEnd
    };

    // Calculate baseline
    const calculatedBaseline = await metricCalculatorRegistry.calculate(
      krData.moduleSelector,
      krData.metricSelector,
      ctx
    );

    // Calculate current value
    const calculatedCurrent = await metricCalculatorRegistry.calculate(
      krData.moduleSelector,
      krData.metricSelector,
      currentCtx
    );

    // Load definition settings
    const template = PREDEFINED_METRICS.find(m => m.module === krData.moduleSelector && m.metricKey === krData.metricSelector);

    return {
      baselineValue: calculatedBaseline,
      currentValue: calculatedCurrent,
      baselinePeriodStart,
      baselinePeriodEnd,
      unit: template?.unit || krData.unit || '',
      measurementType: template?.measurementType || krData.measurementType || 'NUMBER',
      direction: template?.direction || krData.direction || 'HIGHER_IS_BETTER',
      lastCalculatedAt: new Date()
    };
  }

  // Calculate objective completion progress and sync health/derived statuses
  async calculateObjectiveProgress(businessId: string, objectiveId: string) {
    const obj = await db.OkrObjective.findOne({
      where: { id: objectiveId, businessId },
      include: [{ model: db.OkrKeyResult, as: 'keyResults' }]
    });
    if (!obj) return;

    if (!obj.keyResults || obj.keyResults.length === 0) {
      await obj.update({ overallScore: 0, healthStatus: 'ON_TRACK' });
      return;
    }

    let totalWeight = 0;
    let weightedProgressSum = 0;

    for (const kr of obj.keyResults) {
      const progress = this.calculateKrProgress(kr);
      const krHealth = this.calculateKrHealth(progress);
      await kr.update({ status: krHealth });

      const w = kr.weight || 1.0;
      totalWeight += w;
      weightedProgressSum += (progress * w);
    }

    const overallScore = totalWeight > 0 ? Math.round(weightedProgressSum / totalWeight) : 0;

    let derivedHealth = 'ON_TRACK';
    if (obj.lifecycleStatus === 'CLOSED' || overallScore === 100) {
      derivedHealth = 'COMPLETED';
    } else {
      derivedHealth = this.calculateKrHealth(overallScore);
    }

    await obj.update({ overallScore, healthStatus: derivedHealth });
  }

  // -- Objective CRUD --
  async createObjective(businessId: string, createdById: string, data: any) {
    const { keyResults, keyImpacts, ...objData } = data;

    const objective = await db.OkrObjective.create({
      ...objData,
      businessId,
      createdById,
      lifecycleStatus: objData.lifecycleStatus || 'DRAFT'
    });

    if (keyImpacts && Array.isArray(keyImpacts)) {
      for (const text of keyImpacts) {
        if (text && text.trim()) {
          await db.OkrImpact.create({ objectiveId: objective.id, text });
        }
      }
    }

    if (keyResults && Array.isArray(keyResults)) {
      for (const kr of keyResults) {
        let finalKrData = { ...kr, businessId, objectiveId: objective.id };

        if (kr.trackingType === 'AUTOMATIC') {
          const autoData = await this.computeAutomaticBaselineAndCurrent(businessId, objective, kr);
          finalKrData = { ...finalKrData, ...autoData };
        }

        const krRecord = await db.OkrKeyResult.create(finalKrData);
        const progress = this.calculateKrProgress(krRecord);
        await krRecord.update({ status: this.calculateKrHealth(progress) });
      }
    }

    await this.calculateObjectiveProgress(businessId, objective.id);
    return this.getObjective(businessId, objective.id);
  }

  async updateObjective(businessId: string, id: string, data: any) {
    const objective = await db.OkrObjective.findOne({ where: { id, businessId } });
    if (!objective) throw new Error("Objective not found");

    const { keyResults, keyImpacts, ...objData } = data;
    await objective.update(objData);

    if (keyImpacts && Array.isArray(keyImpacts)) {
      await db.OkrImpact.destroy({ where: { objectiveId: id } });
      for (const text of keyImpacts) {
        if (text && text.trim()) {
          await db.OkrImpact.create({ objectiveId: id, text });
        }
      }
    }

    if (keyResults && Array.isArray(keyResults)) {
      const activeIds: string[] = [];
      for (const kr of keyResults) {
        if (kr.id) {
          activeIds.push(kr.id);
          const existing = await db.OkrKeyResult.findOne({ where: { id: kr.id, objectiveId: id } });
          if (existing) {
            let finalKrData = { ...kr };
            if (kr.trackingType === 'AUTOMATIC') {
              const autoData = await this.computeAutomaticBaselineAndCurrent(businessId, objective, kr);
              finalKrData = { ...finalKrData, ...autoData };
            }
            await existing.update(finalKrData);
          }
        } else {
          let finalKrData = { ...kr, businessId, objectiveId: id };
          if (kr.trackingType === 'AUTOMATIC') {
            const autoData = await this.computeAutomaticBaselineAndCurrent(businessId, objective, kr);
            finalKrData = { ...finalKrData, ...autoData };
          }
          const fresh = await db.OkrKeyResult.create(finalKrData);
          activeIds.push(fresh.id);
        }
      }
      // Delete removed KRs
      await db.OkrKeyResult.destroy({ where: { objectiveId: id, id: { [Op.notIn]: activeIds } } });
    }

    await this.calculateObjectiveProgress(businessId, id);
    return this.getObjective(businessId, id);
  }

  async deleteObjective(businessId: string, id: string) {
    const objective = await db.OkrObjective.findOne({ where: { id, businessId } });
    if (!objective) throw new Error("Objective not found");
    await objective.destroy();
    return true;
  }

  async getObjective(businessId: string, id: string) {
    return db.OkrObjective.findOne({
      where: { id, businessId },
      include: [
        { model: db.OkrKeyResult, as: 'keyResults', include: [{ model: db.OkrCheckIn, as: 'checkIns' }] },
        { model: db.OkrImpact, as: 'keyImpacts' },
        { model: db.User, as: 'creator', attributes: ['id', 'fullName', 'email'] },
        { model: db.User, as: 'ownerEmployee', attributes: ['id', 'fullName', 'email'], required: false },
        { model: db.Department, as: 'ownerDepartment', attributes: ['id', 'name'], required: false }
      ]
    });
  }

  async listObjectives(businessId: string, query: any) {
    await this.seedMetricTemplatesIfEmpty();

    const where: any = { businessId };
    if (query.lifecycleStatus) where.lifecycleStatus = query.lifecycleStatus;
    if (query.healthStatus) where.healthStatus = query.healthStatus;
    if (query.ownerType) where.ownerType = query.ownerType;
    if (query.ownerId) where.ownerId = query.ownerId;

    if (query.periodStart && query.periodEnd) {
      where.periodStart = { [Op.gte]: query.periodStart };
      where.periodEnd = { [Op.lte]: query.periodEnd };
    }

    const objectives = await db.OkrObjective.findAll({
      where,
      include: [
        { model: db.OkrKeyResult, as: 'keyResults', include: [{ model: db.OkrCheckIn, as: 'checkIns' }] },
        { model: db.OkrImpact, as: 'keyImpacts' },
        { model: db.User, as: 'ownerEmployee', attributes: ['id', 'fullName', 'email'], required: false },
        { model: db.Department, as: 'ownerDepartment', attributes: ['id', 'name'], required: false }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Compute aggregate summary metrics
    const totalCount = objectives.length;
    let totalScoreSum = 0;
    let onTrackCount = 0;
    let atRiskCount = 0;
    let offTrackCount = 0;

    for (const obj of objectives) {
      totalScoreSum += obj.overallScore || 0;
      if (obj.healthStatus === 'ON_TRACK') onTrackCount++;
      else if (obj.healthStatus === 'AT_RISK') atRiskCount++;
      else if (obj.healthStatus === 'OFF_TRACK') offTrackCount++;
    }

    const avgCompletion = totalCount > 0 ? Math.round(totalScoreSum / totalCount) : 0;
    const metricTemplates = await db.OkrMetricTemplate.findAll();

    return {
      objectives,
      summary: {
        totalCount,
        avgCompletion,
        onTrackCount,
        atRiskCount,
        offTrackCount
      },
      metricTemplates
    };
  }

  // Refresh automatic metrics values
  async refreshAutomaticMetrics(businessId: string, objectiveId?: string) {
    const where: any = { businessId };
    if (objectiveId) where.id = objectiveId;

    const objectives = await db.OkrObjective.findAll({ where });

    for (const obj of objectives) {
      const krs = await db.OkrKeyResult.findAll({
        where: { objectiveId: obj.id, trackingType: 'AUTOMATIC' }
      });

      for (const kr of krs) {
        const currentCtx = {
          businessId,
          ownerType: obj.ownerType,
          ownerId: obj.ownerId,
          startDate: obj.periodStart,
          endDate: obj.periodEnd
        };

        const calculatedCurrent = await metricCalculatorRegistry.calculate(
          kr.moduleSelector,
          kr.metricSelector,
          currentCtx
        );

        await kr.update({
          currentValue: calculatedCurrent,
          lastCalculatedAt: new Date()
        });
      }

      await this.calculateObjectiveProgress(businessId, obj.id);
    }
  }

  // Log manual progress check-in
  async logCheckIn(businessId: string, createdById: string, data: any) {
    const kr = await db.OkrKeyResult.findOne({
      where: { id: data.keyResultId, businessId }
    });
    if (!kr) throw new Error("Key Result not found");

    if (kr.trackingType === 'AUTOMATIC') {
      throw new Error("Cannot log manual check-ins on automatic key results.");
    }

    const checkIn = await db.OkrCheckIn.create({
      businessId,
      keyResultId: kr.id,
      progressValue: data.currentValue, // manual check-in submits the direct currentValue
      date: data.date || new Date().toISOString().split('T')[0],
      note: data.note || '',
      createdById
    });

    await kr.update({ currentValue: data.currentValue });
    await this.calculateObjectiveProgress(businessId, kr.objectiveId);

    return checkIn;
  }
}
export const okrService = new OKRService();
