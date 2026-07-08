import { Op } from "sequelize";
import { db } from "../../models";

export type SalaryDeductionSnapshotInput = {
  businessId: string;
  employeeUserId: string;
  payrollLinkId?: string | null;
  payrollRecordId?: string | null;
  reasonType: string;
  sourceModule: string;
  sourceTable?: string | null;
  sourceRecordId?: string | null;
  relatedDate?: string | null;
  amount: number;
  currency: string;
  description: string;
  metadata?: Record<string, unknown>;
};

export class SalaryDeductionRepository {
  private periodWhere(period?: { start: string; end: string }) {
    return period ? { relatedDate: { [Op.between]: [period.start, period.end] } } : {};
  }

  listForPayrollLink(businessId: string, payrollLinkId: string, period?: { start: string; end: string }) {
    return db.SalaryDeduction.findAll({
      where: { businessId, payrollLinkId, ...this.periodWhere(period) },
      order: [["status", "ASC"], ["relatedDate", "ASC"], ["createdAt", "ASC"]],
    });
  }

  listActiveForPayrollLinkIds(businessId: string, payrollLinkIds: string[], period?: { start: string; end: string }) {
    if (!payrollLinkIds.length) return Promise.resolve([]);
    return db.SalaryDeduction.findAll({
      where: { businessId, payrollLinkId: { [Op.in]: payrollLinkIds }, status: "active", ...this.periodWhere(period) },
      order: [["relatedDate", "ASC"], ["createdAt", "ASC"]],
    });
  }

  findActiveById(businessId: string, deductionId: string) {
    return db.SalaryDeduction.findOne({ where: { businessId, id: deductionId, status: "active" } });
  }

  async upsertSnapshot(input: SalaryDeductionSnapshotInput) {
    const where: any = {
      businessId: input.businessId,
      employeeUserId: input.employeeUserId,
      payrollLinkId: input.payrollLinkId || null,
      payrollRecordId: input.payrollRecordId || null,
      reasonType: input.reasonType,
      sourceModule: input.sourceModule,
      sourceTable: input.sourceTable || null,
      sourceRecordId: input.sourceRecordId || null,
      relatedDate: input.relatedDate || null,
    };
    const existing = await db.SalaryDeduction.findOne({ where, paranoid: false });
    if (existing?.status === "removed" && existing.metadata?.manuallyRemoved === true) return existing;
    if (existing) {
      await existing.update({
        amount: input.amount,
        currency: input.currency,
        description: input.description,
        metadata: input.metadata || {},
        status: "active",
        removedByUserId: null,
        removedAt: null,
      });
      return existing;
    }
    return db.SalaryDeduction.create({ ...input, status: "active", metadata: input.metadata || {} });
  }

  async retireSystemGeneratedForPeriod(businessId: string, payrollLinkId: string, period: { start: string; end: string }) {
    const records = await db.SalaryDeduction.findAll({
      where: {
        businessId,
        payrollLinkId,
        status: "active",
        sourceModule: { [Op.ne]: "payroll" },
        relatedDate: { [Op.between]: [period.start, period.end] },
      },
    });
    for (const record of records) {
      if (record.metadata?.manuallyRemoved === true || record.metadata?.systemGenerated !== true) continue;
      await record.update({
        status: "removed",
        removedAt: new Date(),
        metadata: { ...(record.metadata || {}), retiredBySnapshotRefresh: true },
      });
    }
  }

  markRemoved(record: any, removedByUserId: string) {
    return record.update({
      status: "removed",
      removedByUserId,
      removedAt: new Date(),
      metadata: { ...(record.metadata || {}), manuallyRemoved: true },
    });
  }
}
