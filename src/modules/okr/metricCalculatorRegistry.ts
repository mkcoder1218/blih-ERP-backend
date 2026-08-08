import { db } from '../../models';
import { Op } from 'sequelize';

export interface MetricDefinition {
  module: string;
  metricKey: string;
  title: string;
  unit: string;
  measurementType: string;
  direction: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
}

export const PREDEFINED_METRICS: MetricDefinition[] = [
  // Attendance
  { module: 'Attendance', metricKey: 'on-time-rate', title: 'On-Time Attendance Rate', unit: '%', measurementType: 'PERCENTAGE', direction: 'HIGHER_IS_BETTER' },
  { module: 'Attendance', metricKey: 'avg-lateness', title: 'Average Lateness', unit: 'mins', measurementType: 'NUMBER', direction: 'LOWER_IS_BETTER' },
  { module: 'Attendance', metricKey: 'absence-rate', title: 'Absence Rate', unit: '%', measurementType: 'PERCENTAGE', direction: 'LOWER_IS_BETTER' },
  // Recruitment
  { module: 'Recruitment', metricKey: 'time-to-hire', title: 'Average Time to Hire', unit: 'days', measurementType: 'NUMBER', direction: 'LOWER_IS_BETTER' },
  { module: 'Recruitment', metricKey: 'offer-acceptance', title: 'Offer Acceptance Rate', unit: '%', measurementType: 'PERCENTAGE', direction: 'HIGHER_IS_BETTER' },
  { module: 'Recruitment', metricKey: 'vacancy-fill-rate', title: 'Vacancy Fill Rate', unit: '%', measurementType: 'PERCENTAGE', direction: 'HIGHER_IS_BETTER' },
  // Projects
  { module: 'Projects', metricKey: 'task-completion-rate', title: 'Task Completion Rate', unit: '%', measurementType: 'PERCENTAGE', direction: 'HIGHER_IS_BETTER' },
  { module: 'Projects', metricKey: 'on-time-task-rate', title: 'On-Time Task Completion Rate', unit: '%', measurementType: 'PERCENTAGE', direction: 'HIGHER_IS_BETTER' },
  { module: 'Projects', metricKey: 'overdue-task-rate', title: 'Overdue Task Rate', unit: '%', measurementType: 'PERCENTAGE', direction: 'LOWER_IS_BETTER' },
  // Probation
  { module: 'Probation', metricKey: 'probation-completion-rate', title: 'Probation Completion Rate', unit: '%', measurementType: 'PERCENTAGE', direction: 'HIGHER_IS_BETTER' },
  { module: 'Probation', metricKey: 'probation-pass-rate', title: 'Probation Pass Rate', unit: '%', measurementType: 'PERCENTAGE', direction: 'HIGHER_IS_BETTER' },
  { module: 'Probation', metricKey: 'avg-final-rating', title: 'Average Final Rating', unit: 'score', measurementType: 'NUMBER', direction: 'HIGHER_IS_BETTER' },
  // Leave
  { module: 'Leave', metricKey: 'avg-turnaround-time', title: 'Average Approval Turnaround Time', unit: 'hours', measurementType: 'NUMBER', direction: 'LOWER_IS_BETTER' },
  { module: 'Leave', metricKey: 'pending-requests', title: 'Pending Leave Request Count', unit: 'requests', measurementType: 'NUMBER', direction: 'LOWER_IS_BETTER' },
  { module: 'Leave', metricKey: 'leave-approval-rate', title: 'Leave Approval Rate', unit: '%', measurementType: 'PERCENTAGE', direction: 'HIGHER_IS_BETTER' }
];

export interface CalculatorContext {
  businessId: string;
  ownerType: string;
  ownerId: string | null;
  startDate: string;
  endDate: string;
}

export type CalculatorFn = (ctx: CalculatorContext) => Promise<number>;

class MetricCalculatorRegistry {
  private registry: Map<string, CalculatorFn> = new Map();

  constructor() {
    this.registerCalculators();
  }

  public register(module: string, metricKey: string, fn: CalculatorFn) {
    this.registry.set(`${module}:${metricKey}`, fn);
  }

  public async calculate(module: string, metricKey: string, ctx: CalculatorContext): Promise<number> {
    const fn = this.registry.get(`${module}:${metricKey}`);
    if (!fn) {
      // Fallback or warning
      return 0;
    }
    return fn(ctx);
  }

  private async getEmployeeUserIds(ctx: CalculatorContext): Promise<string[]> {
    if (ctx.ownerType === 'EMPLOYEE' && ctx.ownerId) {
      return [ctx.ownerId];
    }
    if (ctx.ownerType === 'DEPARTMENT' && ctx.ownerId) {
      const records = await db.EmployeeRecord.findAll({
        where: { businessId: ctx.businessId, departmentId: ctx.ownerId },
        attributes: ['userId']
      });
      return records.map((r: any) => r.userId);
    }
    if (ctx.ownerType === 'TEAM' && ctx.ownerId) {
      // Treat TEAM scope similar to department or sub-unit
      const records = await db.EmployeeRecord.findAll({
        where: { businessId: ctx.businessId, departmentId: ctx.ownerId },
        attributes: ['userId']
      });
      return records.map((r: any) => r.userId);
    }
    // COMPANY scope: retrieve all employees of the business
    const records = await db.EmployeeRecord.findAll({
      where: { businessId: ctx.businessId },
      attributes: ['userId']
    });
    return records.map((r: any) => r.userId);
  }

  private registerCalculators() {
    // ==========================================
    // ATTENDANCE CALCULATORS
    // ==========================================
    this.register('Attendance', 'on-time-rate', async (ctx) => {
      const userIds = await this.getEmployeeUserIds(ctx);
      if (userIds.length === 0) return 100;
      const records = await db.AttendanceRecord.findAll({
        where: {
          businessId: ctx.businessId,
          userId: { [Op.in]: userIds },
          date: { [Op.between]: [ctx.startDate, ctx.endDate] }
        }
      });
      const eligible = records.filter((r: any) => r.status === 'present' || r.status === 'late' || r.status === 'half_day');
      if (eligible.length === 0) return 100;
      const onTime = eligible.filter((r: any) => r.status === 'present');
      return Math.round((onTime.length / eligible.length) * 100);
    });

    this.register('Attendance', 'avg-lateness', async (ctx) => {
      const userIds = await this.getEmployeeUserIds(ctx);
      if (userIds.length === 0) return 0;
      const records = await db.AttendanceRecord.findAll({
        where: {
          businessId: ctx.businessId,
          userId: { [Op.in]: userIds },
          date: { [Op.between]: [ctx.startDate, ctx.endDate] },
          status: 'late',
          checkInAt: { [Op.ne]: null }
        }
      });
      if (records.length === 0) return 0;
      let totalLate = 0;
      for (const rec of records) {
        const emp = await db.EmployeeRecord.findOne({ where: { userId: rec.userId, businessId: ctx.businessId } });
        const startStr = emp?.assignedStartTime || '09:00';
        const [sh, sm] = startStr.split(':').map(Number);
        const checkIn = new Date(rec.checkInAt);
        const checkInMins = checkIn.getHours() * 60 + checkIn.getMinutes();
        const startMins = sh * 60 + sm;
        totalLate += Math.max(0, checkInMins - startMins);
      }
      return Math.round(totalLate / records.length);
    });

    this.register('Attendance', 'absence-rate', async (ctx) => {
      const userIds = await this.getEmployeeUserIds(ctx);
      if (userIds.length === 0) return 0;
      const records = await db.AttendanceRecord.findAll({
        where: {
          businessId: ctx.businessId,
          userId: { [Op.in]: userIds },
          date: { [Op.between]: [ctx.startDate, ctx.endDate] }
        }
      });
      const absents = records.filter((r: any) => r.status === 'absent');
      const total = records.length;
      if (total === 0) return 0;
      return Math.round((absents.length / total) * 100);
    });

    // ==========================================
    // RECRUITMENT CALCULATORS
    // ==========================================
    this.register('Recruitment', 'time-to-hire', async (ctx) => {
      const apps = await db.JobApplication.findAll({
        where: {
          businessId: ctx.businessId,
          stage: 'hired',
          createdAt: { [Op.between]: [new Date(ctx.startDate), new Date(ctx.endDate + 'T23:59:59')] }
        }
      });
      if (apps.length === 0) return 0;
      let totalDays = 0;
      for (const app of apps) {
        const diffTime = Math.abs(app.updatedAt.getTime() - app.createdAt.getTime());
        totalDays += Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
      return Math.round(totalDays / apps.length);
    });

    this.register('Recruitment', 'offer-acceptance', async (ctx) => {
      const offers = await db.OfferLetter.findAll({
        where: {
          businessId: ctx.businessId,
          status: { [Op.in]: ['ACCEPTED', 'REJECTED'] },
          createdAt: { [Op.between]: [new Date(ctx.startDate), new Date(ctx.endDate + 'T23:59:59')] }
        }
      });
      if (offers.length === 0) return 100;
      const accepted = offers.filter((o: any) => o.status === 'ACCEPTED');
      return Math.round((accepted.length / offers.length) * 100);
    });

    this.register('Recruitment', 'vacancy-fill-rate', async (ctx) => {
      const openings = await db.JobOpening.findAll({
        where: {
          businessId: ctx.businessId,
          status: 'closed',
          updatedAt: { [Op.between]: [new Date(ctx.startDate), new Date(ctx.endDate + 'T23:59:59')] }
        }
      });
      if (openings.length === 0) return 100;
      let totalRequired = 0;
      let totalFilled = 0;
      for (const op of openings) {
        totalRequired += op.headcount || 1;
        const filledCount = await db.JobApplication.count({
          where: { businessId: ctx.businessId, jobOpeningId: op.id, stage: 'hired' }
        });
        totalFilled += filledCount;
      }
      if (totalRequired === 0) return 100;
      return Math.round((totalFilled / totalRequired) * 100);
    });

    // ==========================================
    // PROJECTS CALCULATORS
    // ==========================================
    this.register('Projects', 'task-completion-rate', async (ctx) => {
      const where: any = { businessId: ctx.businessId };
      if (ctx.ownerType === 'EMPLOYEE' && ctx.ownerId) {
        where.assignedToUserId = ctx.ownerId;
      }
      const tasks = await db.ProjectTask.findAll({ where });
      if (tasks.length === 0) return 100;
      const completed = tasks.filter((t: any) => t.status === 'DONE' || t.status === 'COMPLETED');
      return Math.round((completed.length / tasks.length) * 100);
    });

    this.register('Projects', 'on-time-task-rate', async (ctx) => {
      const where: any = { businessId: ctx.businessId };
      if (ctx.ownerType === 'EMPLOYEE' && ctx.ownerId) {
        where.assignedToUserId = ctx.ownerId;
      }
      const completedTasks = await db.ProjectTask.findAll({
        where: {
          ...where,
          status: { [Op.in]: ['DONE', 'COMPLETED'] }
        }
      });
      if (completedTasks.length === 0) return 100;
      const onTime = completedTasks.filter((t: any) => {
        if (!t.dueDate) return true;
        return new Date(t.updatedAt) <= new Date(t.dueDate + 'T23:59:59');
      });
      return Math.round((onTime.length / completedTasks.length) * 100);
    });

    this.register('Projects', 'overdue-task-rate', async (ctx) => {
      const where: any = { businessId: ctx.businessId };
      if (ctx.ownerType === 'EMPLOYEE' && ctx.ownerId) {
        where.assignedToUserId = ctx.ownerId;
      }
      const tasks = await db.ProjectTask.findAll({ where });
      if (tasks.length === 0) return 0;
      const overdue = tasks.filter((t: any) => {
        if (t.status === 'DONE' || t.status === 'COMPLETED') return false;
        if (!t.dueDate) return false;
        return new Date() > new Date(t.dueDate + 'T23:59:59');
      });
      return Math.round((overdue.length / tasks.length) * 100);
    });

    // ==========================================
    // PROBATION CALCULATORS
    // ==========================================
    this.register('Probation', 'probation-completion-rate', async (ctx) => {
      const probations = await db.EmployeeProbation.findAll({
        where: {
          businessId: ctx.businessId,
          expectedEndDate: { [Op.between]: [ctx.startDate, ctx.endDate] }
        }
      });
      if (probations.length === 0) return 100;
      const completed = probations.filter((p: any) => ['CONFIRMED', 'TERMINATED'].includes(p.status));
      return Math.round((completed.length / probations.length) * 100);
    });

    this.register('Probation', 'probation-pass-rate', async (ctx) => {
      const finalized = await db.EmployeeProbation.findAll({
        where: {
          businessId: ctx.businessId,
          status: 'CONFIRMED',
          expectedEndDate: { [Op.between]: [ctx.startDate, ctx.endDate] }
        }
      });
      const allFinalized = await db.EmployeeProbation.findAll({
        where: {
          businessId: ctx.businessId,
          status: { [Op.in]: ['CONFIRMED', 'TERMINATED'] },
          expectedEndDate: { [Op.between]: [ctx.startDate, ctx.endDate] }
        }
      });
      if (allFinalized.length === 0) return 100;
      return Math.round((finalized.length / allFinalized.length) * 100);
    });

    this.register('Probation', 'avg-final-rating', async (ctx) => {
      const finalized = await db.EmployeeProbation.findAll({
        where: {
          businessId: ctx.businessId,
          status: { [Op.in]: ['CONFIRMED', 'TERMINATED'] },
          expectedEndDate: { [Op.between]: [ctx.startDate, ctx.endDate] },
          finalScore: { [Op.ne]: null }
        }
      });
      if (finalized.length === 0) return 0;
      const sum = finalized.reduce((acc: number, p: any) => acc + parseFloat(p.finalScore || 0), 0);
      return Math.round((sum / finalized.length) * 10) / 10;
    });

    // ==========================================
    // LEAVE CALCULATORS
    // ==========================================
    this.register('Leave', 'avg-turnaround-time', async (ctx) => {
      const requests = await db.LeaveRequest.findAll({
        where: {
          businessId: ctx.businessId,
          status: { [Op.in]: ['approved', 'rejected'] },
          createdAt: { [Op.between]: [new Date(ctx.startDate), new Date(ctx.endDate + 'T23:59:59')] }
        }
      });
      if (requests.length === 0) return 0;
      let totalHours = 0;
      for (const r of requests) {
        const actionDate = r.adminActionAt || r.rejectedAt || r.updatedAt;
        const diffMs = actionDate.getTime() - r.createdAt.getTime();
        totalHours += diffMs / (1000 * 60 * 60);
      }
      return Math.round(totalHours / requests.length);
    });

    this.register('Leave', 'pending-requests', async (ctx) => {
      const count = await db.LeaveRequest.count({
        where: {
          businessId: ctx.businessId,
          status: 'pending'
        }
      });
      return count;
    });

    this.register('Leave', 'leave-approval-rate', async (ctx) => {
      const totalProcessed = await db.LeaveRequest.findAll({
        where: {
          businessId: ctx.businessId,
          status: { [Op.in]: ['approved', 'rejected'] },
          createdAt: { [Op.between]: [new Date(ctx.startDate), new Date(ctx.endDate + 'T23:59:59')] }
        }
      });
      if (totalProcessed.length === 0) return 100;
      const approved = totalProcessed.filter((r: any) => r.status === 'approved');
      return Math.round((approved.length / totalProcessed.length) * 100);
    });
  }
}

export const metricCalculatorRegistry = new MetricCalculatorRegistry();
