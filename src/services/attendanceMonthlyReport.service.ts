import { AttendanceDailyReportService, type AttendanceDailyReportRow } from "./attendanceDailyReport.service";
import { AttendanceDeductionService } from "./attendanceDeduction.service";
import { AttendanceMonthlyLeaveReportService } from "./attendanceMonthlyLeaveReport.service";
import { AttendanceMonthlyOvertimeReportService } from "./attendanceMonthlyOvertimeReport.service";

export type AttendanceAccountabilityFlag = "Mgr-Art61" | "Watch" | "Excellent" | "Good";

export type AttendanceMonthlyReportRow = {
  Month: string;
  EmployeeId: string;
  EmployeeName: string;
  Department: string | null;
  EmploymentCategory: "Managerial" | "Non-Managerial" | null;
  ScheduledWorkDays: number;
  DaysOnTime: number;
  DaysLateWithNotice: number;
  DaysLateNoNotice: number;
  DaysAbsent: number;
  DaysIncompletePunch: number;
  PunctualityRatePercent: number;
  LatenessNoticesUsed: number;
  LatenessNoticesUsedByReason?: Record<string, number>;
  SicknessUsed?: number;
  TransportUsed?: number;
  FamilyEmergencyUsed?: number;
  MedicalAppointmentUsed?: number;
  TotalMinutesLate: number;
  TotalHoursWorked: number;
  ApprovedOvertimeHours: number;
  HalfDayDeductions: number;
  FullDayDeductions: number;
  DeductedHours: number;
  AnnualLeaveDaysUsed: number;
  SickLeaveDaysUsed: number;
  OtherLeaveDaysUsed: number;
  AnnualLeaveBalanceRemaining: number;
  AccountabilityFlag: AttendanceAccountabilityFlag;
};

export type AttendanceMonthlyReportOptions = {
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

function accountabilityFlag(row: AttendanceMonthlyReportRow): AttendanceAccountabilityFlag {
  if (row.EmploymentCategory === "Managerial") return "Mgr-Art61";
  if (row.FullDayDeductions > 0 || row.PunctualityRatePercent < 70) return "Watch";
  if (row.PunctualityRatePercent >= 95) return "Excellent";
  return "Good";
}

export class AttendanceMonthlyReportService {
  constructor(
    private readonly dailyReportService = new AttendanceDailyReportService(),
    private readonly deductionService = new AttendanceDeductionService(),
    private readonly leaveReportService = new AttendanceMonthlyLeaveReportService(),
    private readonly overtimeReportService = new AttendanceMonthlyOvertimeReportService()
  ) {}

  async generate(businessId: string, opts: AttendanceMonthlyReportOptions): Promise<AttendanceMonthlyReportRow[]> {
    const { startDate, endDate } = monthBounds(opts.month);
    const [dailyRows, leaveRows, overtimeRows] = await Promise.all([
      this.dailyReportService.generate(businessId, {
        startDate,
        endDate,
        departmentId: opts.departmentId,
        employeeId: opts.employeeId,
        audience: opts.audience || "hr",
      }),
      this.leaveReportService.generate(businessId, opts),
      this.overtimeReportService.generate(businessId, opts),
    ]);

    return this.aggregate(opts.month, dailyRows, leaveRows, overtimeRows);
  }

  aggregate(month: string, dailyRows: AttendanceDailyReportRow[], leaveRows: any[] = [], overtimeRows: any[] = []): AttendanceMonthlyReportRow[] {
    const leaveByEmployee = new Map<string, any>(leaveRows.map((row) => [row.EmployeeId, row]));
    const overtimeByEmployee = new Map<string, any>(overtimeRows.map((row) => [row.EmployeeId, row]));
    const byEmployee = new Map<string, AttendanceMonthlyReportRow>();

    for (const daily of dailyRows) {
      const existing = byEmployee.get(daily.EmployeeId) || {
        Month: month,
        EmployeeId: daily.EmployeeId,
        EmployeeName: daily.EmployeeName,
        Department: daily.Department,
        EmploymentCategory: daily.EmploymentCategory,
        ScheduledWorkDays: 0,
        DaysOnTime: 0,
        DaysLateWithNotice: 0,
        DaysLateNoNotice: 0,
        DaysAbsent: 0,
        DaysIncompletePunch: 0,
        PunctualityRatePercent: 0,
        LatenessNoticesUsed: 0,
        TotalMinutesLate: 0,
        TotalHoursWorked: 0,
        ApprovedOvertimeHours: 0,
        HalfDayDeductions: 0,
        FullDayDeductions: 0,
        DeductedHours: 0,
        AnnualLeaveDaysUsed: 0,
        SickLeaveDaysUsed: 0,
        OtherLeaveDaysUsed: 0,
        AnnualLeaveBalanceRemaining: 0,
        AccountabilityFlag: "Good",
      };

      const deduction = this.deductionService.calculate(daily);
      existing.ScheduledWorkDays += 1;
      if (daily.LatenessStatus === "OnTime") existing.DaysOnTime += 1;
      if (daily.LatenessStatus === "Late-WithNotice") existing.DaysLateWithNotice += 1;
      if (daily.LatenessStatus === "Late-NoNotice") existing.DaysLateNoNotice += 1;
      if (daily.LatenessStatus === "Absent") existing.DaysAbsent += 1;
      if (daily.LatenessStatus === "IncompletePunch") existing.DaysIncompletePunch += 1;
      if (daily.NoticeStatus === "Approved") existing.LatenessNoticesUsed += 1;
      if (daily.LatenessStatus === "Late-WithNotice" && daily.LatenessReasonCode) {
        if (!existing.LatenessNoticesUsedByReason) existing.LatenessNoticesUsedByReason = {};
        existing.LatenessNoticesUsedByReason![daily.LatenessReasonCode] = (existing.LatenessNoticesUsedByReason![daily.LatenessReasonCode] || 0) + 1;
        existing.SicknessUsed = existing.LatenessNoticesUsedByReason.SICKNESS || 0;
        existing.TransportUsed = existing.LatenessNoticesUsedByReason.TRANSPORT || 0;
        existing.FamilyEmergencyUsed = existing.LatenessNoticesUsedByReason.FAMILY_EMERGENCY || 0;
        existing.MedicalAppointmentUsed = existing.LatenessNoticesUsedByReason.MEDICAL_APPOINTMENT || 0;
      }
      existing.TotalMinutesLate += Number(daily.MinutesLate || 0);
      existing.TotalHoursWorked += Number(daily.TotalHoursWorked ?? daily.NetHoursWorked ?? 0);
      existing.HalfDayDeductions += deduction.HalfDayDeductions;
      existing.FullDayDeductions += deduction.FullDayDeductions;
      existing.DeductedHours += deduction.DeductedHours;
      existing.PunctualityRatePercent = existing.ScheduledWorkDays ? Math.round((existing.DaysOnTime / existing.ScheduledWorkDays) * 100) : 0;
      existing.TotalHoursWorked = Math.round(existing.TotalHoursWorked * 100) / 100;
      existing.DeductedHours = Math.round(existing.DeductedHours * 100) / 100;

      byEmployee.set(daily.EmployeeId, existing);
    }

    for (const [employeeId, row] of byEmployee.entries()) {
      const leave = leaveByEmployee.get(employeeId);
      if (leave) {
        row.AnnualLeaveDaysUsed = Number(leave.AnnualLeaveDaysUsed || 0);
        row.SickLeaveDaysUsed = Number(leave.SickLeaveDaysUsed || 0);
        row.OtherLeaveDaysUsed = Number(leave.OtherLeaveDaysUsed || 0);
        row.AnnualLeaveBalanceRemaining = Number(leave.AnnualLeaveBalanceRemaining || 0);
      }
      const overtime = overtimeByEmployee.get(employeeId);
      if (overtime) row.ApprovedOvertimeHours = Number(overtime.ApprovedOvertimeHours || 0);
      row.AccountabilityFlag = accountabilityFlag(row);
    }

    return Array.from(byEmployee.values()).sort((a, b) => a.EmployeeName.localeCompare(b.EmployeeName));
  }
}
