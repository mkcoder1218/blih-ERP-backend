import { db } from '../../models';
import { Op, Transaction } from 'sequelize';
import { metricCalculatorRegistry } from './metricCalculatorRegistry';

export class KpiService {
  // Predefined templates matching PREDEFINED_METRICS
  private static PREDEFINED_TEMPLATES = [
    { module: 'Attendance', metricKey: 'on-time-rate', title: 'On-Time Attendance Rate', unit: '%', measurementType: 'PERCENTAGE', direction: 'INCREASE' },
    { module: 'Attendance', metricKey: 'avg-lateness', title: 'Average Lateness', unit: 'mins', measurementType: 'NUMBER', direction: 'DECREASE' },
    { module: 'Attendance', metricKey: 'absence-rate', title: 'Absence Rate', unit: '%', measurementType: 'PERCENTAGE', direction: 'DECREASE' },
    { module: 'Recruitment', metricKey: 'time-to-hire', title: 'Average Time to Hire', unit: 'days', measurementType: 'NUMBER', direction: 'DECREASE' },
    { module: 'Recruitment', metricKey: 'offer-acceptance', title: 'Offer Acceptance Rate', unit: '%', measurementType: 'PERCENTAGE', direction: 'INCREASE' },
    { module: 'Recruitment', metricKey: 'vacancy-fill-rate', title: 'Vacancy Fill Rate', unit: '%', measurementType: 'PERCENTAGE', direction: 'INCREASE' },
    { module: 'Projects', metricKey: 'task-completion-rate', title: 'Task Completion Rate', unit: '%', measurementType: 'PERCENTAGE', direction: 'INCREASE' },
    { module: 'Projects', metricKey: 'on-time-task-rate', title: 'On-Time Task Completion Rate', unit: '%', measurementType: 'PERCENTAGE', direction: 'INCREASE' },
    { module: 'Projects', metricKey: 'overdue-task-rate', title: 'Overdue Task Rate', unit: '%', measurementType: 'PERCENTAGE', direction: 'DECREASE' },
    { module: 'Probation', metricKey: 'probation-completion-rate', title: 'Probation Completion Rate', unit: '%', measurementType: 'PERCENTAGE', direction: 'INCREASE' },
    { module: 'Probation', metricKey: 'probation-pass-rate', title: 'Probation Pass Rate', unit: '%', measurementType: 'PERCENTAGE', direction: 'INCREASE' },
    { module: 'Probation', metricKey: 'avg-final-rating', title: 'Average Final Rating', unit: 'score', measurementType: 'NUMBER', direction: 'INCREASE' },
    { module: 'Leave', metricKey: 'avg-turnaround-time', title: 'Average Approval Turnaround Time', unit: 'hours', measurementType: 'NUMBER', direction: 'DECREASE' },
    { module: 'Leave', metricKey: 'pending-requests', title: 'Pending Leave Request Count', unit: 'requests', measurementType: 'NUMBER', direction: 'DECREASE' },
    { module: 'Leave', metricKey: 'leave-approval-rate', title: 'Leave Approval Rate', unit: '%', measurementType: 'PERCENTAGE', direction: 'INCREASE' }
  ];

  async seedTemplatesIfEmpty() {
    const count = await db.KpiMetricTemplate.count();
    if (count === 0) {
      const now = new Date();
      await db.KpiMetricTemplate.bulkCreate(
        KpiService.PREDEFINED_TEMPLATES.map(t => ({
          ...t,
          createdAt: now,
          updatedAt: now
        }))
      );
    }
  }

  async getMetricTemplates() {
    await this.seedTemplatesIfEmpty();
    return db.KpiMetricTemplate.findAll();
  }

  // Calculate baseline & current periods
  getPeriods(frequency: string) {
    const end = new Date();
    let days = 30;
    if (frequency === 'WEEKLY') days = 7;
    else if (frequency === 'QUARTERLY') days = 90;
    else if (frequency === 'ANNUAL') days = 365;

    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    const baselineStart = new Date(start.getTime() - days * 24 * 60 * 60 * 1000);

    return {
      currentStart: start.toISOString().split('T')[0],
      currentEnd: end.toISOString().split('T')[0],
      baselineStart: baselineStart.toISOString().split('T')[0],
      baselineEnd: start.toISOString().split('T')[0]
    };
  }

  // Polymorphic owner validation helper
  async validateOwner(businessId: string, ownerType: string, ownerId: string | null) {
    if (ownerType === 'COMPANY') return true;
    if (!ownerId) throw new Error(`ownerId is required for type ${ownerType}`);

    if (ownerType === 'EMPLOYEE') {
      const exists = await db.User.findOne({ where: { id: ownerId, businessId } });
      if (!exists) throw new Error("Employee not found in business");
    } else if (ownerType === 'DEPARTMENT' || ownerType === 'TEAM') {
      const exists = await db.Department.findOne({ where: { id: ownerId, businessId } });
      if (!exists) throw new Error("Department/Team unit not found in business");
    }
    return true;
  }

  deriveKpiStatus(current: number, baseline: number, target: number, direction: string): string {
    if (direction === 'INCREASE') {
      if (current >= target) return 'EXCEEDING_TARGET';
      const progress = target === baseline ? 100 : ((current - baseline) / (target - baseline)) * 100;
      return progress >= 80 ? 'ON_TARGET' : 'BELOW_TARGET';
    } else {
      if (current <= target) return 'EXCEEDING_TARGET';
      const progress = target === baseline ? 100 : ((baseline - current) / (baseline - target)) * 100;
      return progress >= 80 ? 'ON_TARGET' : 'BELOW_TARGET';
    }
  }

  async calculateAutomaticKpiValues(businessId: string, kpi: any) {
    const periods = this.getPeriods(kpi.updateFrequency);
    
    // Calculate current
    const currentContext = {
      businessId,
      ownerType: kpi.ownerType,
      ownerId: kpi.ownerId,
      startDate: periods.currentStart,
      endDate: periods.currentEnd
    };
    const currentVal = await metricCalculatorRegistry.calculate(kpi.moduleSelector, kpi.metricSelector, currentContext);

    // Calculate baseline
    const baselineContext = {
      businessId,
      ownerType: kpi.ownerType,
      ownerId: kpi.ownerId,
      startDate: periods.baselineStart,
      endDate: periods.baselineEnd
    };
    const baselineVal = await metricCalculatorRegistry.calculate(kpi.moduleSelector, kpi.metricSelector, baselineContext);

    return {
      baselineValue: baselineVal,
      currentValue: currentVal,
      metadata: {
        periods,
        calculatedAt: new Date()
      }
    };
  }

  // --- KPI CRUD ---
  async createKpi(businessId: string, createdById: string, data: any) {
    await this.validateOwner(businessId, data.ownerType, data.ownerId);

    let baseline = data.baselineValue || 0.0;
    let current = data.currentValue || 0.0;
    let meta: any = null;

    if (data.trackingType === 'AUTOMATIC') {
      const mockKpi = { ...data };
      const autoVals = await this.calculateAutomaticKpiValues(businessId, mockKpi);
      baseline = autoVals.baselineValue;
      current = autoVals.currentValue;
      meta = autoVals.metadata;
    }

    const status = this.deriveKpiStatus(current, baseline, data.targetValue, data.direction);

    const kpi = await db.Kpi.create({
      ...data,
      businessId,
      createdById,
      baselineValue: baseline,
      currentValue: current,
      status,
      isActive: data.isActive !== false
    });

    // Save history
    await db.KpiValueHistory.create({
      businessId,
      kpiId: kpi.id,
      value: current,
      previousValue: null,
      source: kpi.trackingType,
      date: new Date().toISOString().split('T')[0],
      note: 'Initial KPI creation metric snapshot',
      calculatedAt: new Date(),
      calculationMetadata: meta,
      createdById
    });

    return kpi;
  }

  async getKpi(businessId: string, id: string) {
    const kpi = await db.Kpi.findOne({
      where: { id, businessId },
      include: [
        { model: db.User, as: 'creator', attributes: ['id', 'fullName', 'email'] },
        { model: db.User, as: 'ownerEmployee', attributes: ['id', 'fullName', 'email'], constraints: false },
        { model: db.Department, as: 'ownerDepartment', attributes: ['id', 'name'], constraints: false }
      ]
    });
    if (!kpi) throw new Error("KPI not found");
    return kpi;
  }

  async updateKpi(businessId: string, id: string, data: any) {
    const kpi = await this.getKpi(businessId, id);
    await this.validateOwner(businessId, data.ownerType || kpi.ownerType, data.ownerId !== undefined ? data.ownerId : kpi.ownerId);

    const prevValue = kpi.currentValue;
    let baseline = data.baselineValue !== undefined ? data.baselineValue : kpi.baselineValue;
    let current = data.currentValue !== undefined ? data.currentValue : kpi.currentValue;
    let meta: any = null;

    if (data.trackingType === 'AUTOMATIC' || (kpi.trackingType === 'AUTOMATIC' && data.trackingType !== 'MANUAL')) {
      const mergedKpi = { ...kpi.toJSON(), ...data };
      const autoVals = await this.calculateAutomaticKpiValues(businessId, mergedKpi);
      baseline = autoVals.baselineValue;
      current = autoVals.currentValue;
      meta = autoVals.metadata;
    }

    const targetVal = data.targetValue !== undefined ? data.targetValue : kpi.targetValue;
    const direction = data.direction || kpi.direction;
    const status = this.deriveKpiStatus(current, baseline, targetVal, direction);

    await kpi.update({
      ...data,
      baselineValue: baseline,
      currentValue: current,
      status
    });

    if (prevValue !== current) {
      await db.KpiValueHistory.create({
        businessId,
        kpiId: kpi.id,
        value: current,
        previousValue: prevValue,
        source: kpi.trackingType,
        date: new Date().toISOString().split('T')[0],
        note: data.note || 'Metric updated during KPI modification',
        calculatedAt: new Date(),
        calculationMetadata: meta,
        createdById: kpi.createdById
      });
    }

    return this.getKpi(businessId, id);
  }

  async deleteKpi(businessId: string, id: string) {
    const kpi = await this.getKpi(businessId, id);
    await kpi.destroy();
    return true;
  }

  async listKpis(businessId: string, filters: any) {
    const where: any = { businessId };
    if (filters.status) where.status = filters.status;
    if (filters.category) where.category = filters.category;
    if (filters.ownerType) where.ownerType = filters.ownerType;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.moduleSelector) where.moduleSelector = filters.moduleSelector;
    if (filters.isActive !== undefined) where.isActive = filters.isActive === 'true';

    if (filters.search) {
      where.title = { [Op.iLike]: `%${filters.search}%` };
    }

    const { limit = 20, offset = 0 } = filters;

    const { rows, count } = await db.Kpi.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']],
      include: [
        { model: db.User, as: 'creator', attributes: ['id', 'fullName', 'email'] },
        { model: db.User, as: 'ownerEmployee', attributes: ['id', 'fullName', 'email'], constraints: false },
        { model: db.Department, as: 'ownerDepartment', attributes: ['id', 'name'], constraints: false }
      ]
    });

    // Preseed metric templates if requested as well
    const metricTemplates = await this.getMetricTemplates();

    return { kpis: rows, count, metricTemplates };
  }

  async logKpiManualValue(businessId: string, userId: string, kpiId: string, value: number, note?: string) {
    const kpi = await this.getKpi(businessId, kpiId);
    if (kpi.trackingType !== 'MANUAL') {
      throw new Error("Cannot manually update values for automatic KPIs");
    }

    const prevValue = kpi.currentValue;
    const status = this.deriveKpiStatus(value, kpi.baselineValue, kpi.targetValue, kpi.direction);

    await kpi.update({ currentValue: value, status });

    const history = await db.KpiValueHistory.create({
      businessId,
      kpiId,
      value,
      previousValue: prevValue,
      source: 'MANUAL',
      date: new Date().toISOString().split('T')[0],
      note: note || 'Manual KPI value check-in logged',
      calculatedAt: new Date(),
      createdById: userId
    });

    return { kpi, history };
  }

  async syncAutomaticKpis(businessId: string) {
    const kpis = await db.Kpi.findAll({
      where: { businessId, trackingType: 'AUTOMATIC', isActive: true }
    });

    for (const kpi of kpis) {
      const autoVals = await this.calculateAutomaticKpiValues(businessId, kpi);
      const prevValue = kpi.currentValue;
      const status = this.deriveKpiStatus(autoVals.currentValue, autoVals.baselineValue, kpi.targetValue, kpi.direction);

      await kpi.update({
        baselineValue: autoVals.baselineValue,
        currentValue: autoVals.currentValue,
        status
      });

      if (prevValue !== autoVals.currentValue) {
        await db.KpiValueHistory.create({
          businessId,
          kpiId: kpi.id,
          value: autoVals.currentValue,
          previousValue: prevValue,
          source: 'AUTOMATIC',
          date: new Date().toISOString().split('T')[0],
          note: 'Automatic background synchronization check-in',
          calculatedAt: new Date(),
          calculationMetadata: autoVals.metadata
        });
      }
    }
  }

  async getKpiTrendHistory(businessId: string, kpiId: string) {
    const history = await db.KpiValueHistory.findAll({
      where: { businessId, kpiId },
      order: [['calculatedAt', 'ASC']],
      limit: 30
    });
    return history;
  }

  async getDashboardSummary(businessId: string) {
    const kpis = await db.Kpi.findAll({ where: { businessId, isActive: true } });
    const totalCount = kpis.length;
    let exceeding = 0;
    let onTarget = 0;
    let belowTarget = 0;
    let scoreSum = 0;

    for (const kpi of kpis) {
      let progress = 0;
      if (kpi.direction === 'INCREASE') {
        progress = kpi.targetValue === kpi.baselineValue ? 100 : ((kpi.currentValue - kpi.baselineValue) / (kpi.targetValue - kpi.baselineValue)) * 100;
      } else {
        progress = kpi.targetValue === kpi.baselineValue ? 100 : ((kpi.baselineValue - kpi.currentValue) / (kpi.baselineValue - kpi.targetValue)) * 100;
      }
      // Allow scores to exceed 100% in calculations
      scoreSum += progress;

      if (kpi.status === 'EXCEEDING_TARGET') exceeding++;
      else if (kpi.status === 'ON_TARGET') onTarget++;
      else belowTarget++;
    }

    const avgScore = totalCount > 0 ? Math.round(scoreSum / totalCount) : 0;

    return {
      totalCount,
      exceedingCount: exceeding,
      onTargetCount: onTarget,
      belowTargetCount: belowTarget,
      avgScoreRate: avgScore
    };
  }
}

export const kpiService = new KpiService();
