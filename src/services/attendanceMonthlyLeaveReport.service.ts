import { Op } from "sequelize";
import { db } from "../models";
import { AttendanceDailyReportService } from "./attendanceDailyReport.service";

export type AttendanceMonthlyLeaveReportRow = {
  Month: string;
  EmployeeId: string;
  EmployeeName: string;
  Department: string | null;
  AnnualLeaveDaysUsed: number;
  SickLeaveDaysUsed: number;
  OtherLeaveDaysUsed: number;
  AnnualLeaveBalanceRemaining: number;
};

export type AttendanceMonthlyLeaveReportOptions = {
  month: string;
  departmentId?: string | null;
  employeeId?: string | null;
  audience?: "hr" | "public";
};

function monthBounds(month: string) {
  const startDate = `${month}-01`;
  const end = new Date(`${startDate}T00:00:00.000Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);
  return { startDate, endDate: end.toISOString().slice(0, 10) };
}

function yearEndForMonth(month: string) {
  const { endDate } = monthBounds(month);
  return endDate;
}

function leaveCategory(leaveType: unknown): "annual" | "sick" | "other" {
  const normalized = String(leaveType || "").toLowerCase();
  if (normalized.includes("annual")) return "annual";
  if (normalized.includes("sick")) return "sick";
  return "other";
}

function overlapDays(startA: string, endA: string, startB: string, endB: string) {
  const start = new Date(`${startA > startB ? startA : startB}T00:00:00.000Z`);
  const end = new Date(`${endA < endB ? endA : endB}T00:00:00.000Z`);
  if (start.getTime() > end.getTime()) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

export class AttendanceMonthlyLeaveReportService {
  constructor(private readonly dailyReportService = new AttendanceDailyReportService()) {}

  async generate(businessId: string, opts: AttendanceMonthlyLeaveReportOptions): Promise<AttendanceMonthlyLeaveReportRow[]> {
    const { startDate, endDate } = monthBounds(opts.month);
    const dailyRows = await this.dailyReportService.generate(businessId, {
      startDate,
      endDate,
      departmentId: opts.departmentId,
      employeeId: opts.employeeId,
      audience: opts.audience || "hr",
    });

    const employeeIds = Array.from(new Set(dailyRows.map((row) => row.EmployeeId)));
    const employeeWhere = employeeIds.length ? { [Op.in]: employeeIds } : { [Op.in]: ["00000000-0000-0000-0000-000000000000"] };

    const [approvedLeaves, annualBalances] = await Promise.all([
      db.LeaveRequest.findAll({
        where: {
          businessId,
          employeeUserId: employeeWhere,
          status: "approved",
          [Op.or]: [
            { startDate: { [Op.between]: [startDate, endDate] } },
            { endDate: { [Op.between]: [startDate, endDate] } },
            { startDate: { [Op.lte]: startDate }, endDate: { [Op.gte]: endDate } },
          ],
        },
      }),
      db.LeaveBalance.findAll({
        where: {
          businessId,
          userId: employeeWhere,
          leaveType: "annual",
          year: Number(opts.month.slice(0, 4)),
        },
      }),
    ]);

    const rowsByEmployee = new Map<string, AttendanceMonthlyLeaveReportRow>();
    for (const daily of dailyRows) {
      if (!rowsByEmployee.has(daily.EmployeeId)) {
        rowsByEmployee.set(daily.EmployeeId, {
          Month: opts.month,
          EmployeeId: daily.EmployeeId,
          EmployeeName: daily.EmployeeName,
          Department: daily.Department,
          AnnualLeaveDaysUsed: 0,
          SickLeaveDaysUsed: 0,
          OtherLeaveDaysUsed: 0,
          AnnualLeaveBalanceRemaining: 0,
        });
      }
    }

    for (const leave of approvedLeaves) {
      const row = rowsByEmployee.get(leave.employeeUserId);
      if (!row) continue;
      const days = overlapDays(leave.startDate, leave.endDate, startDate, endDate);
      const category = leaveCategory(leave.leaveType);
      if (category === "annual") row.AnnualLeaveDaysUsed += days;
      else if (category === "sick") row.SickLeaveDaysUsed += days;
      else row.OtherLeaveDaysUsed += days;
    }

    const ytdAnnualUsed = new Map<string, number>();
    if (employeeIds.length) {
      const ytdLeaves = await db.LeaveRequest.findAll({
        where: {
          businessId,
          employeeUserId: employeeWhere,
          status: "approved",
          leaveType: { [Op.iLike]: "%annual%" },
          startDate: { [Op.lte]: yearEndForMonth(opts.month) },
          endDate: { [Op.gte]: `${opts.month.slice(0, 4)}-01-01` },
        },
      });
      for (const leave of ytdLeaves) {
        const days = overlapDays(leave.startDate, leave.endDate, `${opts.month.slice(0, 4)}-01-01`, yearEndForMonth(opts.month));
        ytdAnnualUsed.set(leave.employeeUserId, (ytdAnnualUsed.get(leave.employeeUserId) || 0) + days);
      }
    }

    for (const balance of annualBalances) {
      const row = rowsByEmployee.get(balance.userId);
      if (!row) continue;
      const entitlement = Number(balance.totalDays || 0);
      row.AnnualLeaveBalanceRemaining = Math.max(0, entitlement - (ytdAnnualUsed.get(balance.userId) || 0));
    }

    return Array.from(rowsByEmployee.values()).sort((a, b) => a.EmployeeName.localeCompare(b.EmployeeName));
  }
}
