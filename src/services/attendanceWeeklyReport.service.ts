import { AttendanceDailyReportService, type AttendanceDailyReportRow } from "./attendanceDailyReport.service";
import { AttendanceDeductionService } from "./attendanceDeduction.service";

export type AttendanceWeeklyReportRow = {
  WeekStartDate: string;
  WeekEndDate: string;
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
  LatenessNoticesUsed: number;
  LatenessNoticesUsedByReason?: Record<string, number>;
  SicknessUsed?: number;
  TransportUsed?: number;
  FamilyEmergencyUsed?: number;
  MedicalAppointmentUsed?: number;
  PunctualityRatePercent: number;
  NetHoursWorked: number;
  HalfDayDeductions: number;
  FullDayDeductions: number;
};

export type AttendanceWeeklyReportOptions = {
  startDate: string;
  endDate: string;
  departmentId?: string | null;
  employeeId?: string | null;
  audience?: "hr" | "public";
};

function weekStart(dateYmd: string) {
  const date = new Date(`${dateYmd}T00:00:00.000Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function weekEnd(dateYmd: string) {
  const date = new Date(`${weekStart(dateYmd)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 6);
  return date.toISOString().slice(0, 10);
}

function keyFor(row: AttendanceDailyReportRow) {
  return `${row.EmployeeId}__${weekStart(row.Date)}`;
}

export class AttendanceWeeklyReportService {
  constructor(
    private readonly dailyReportService = new AttendanceDailyReportService(),
    private readonly deductionService = new AttendanceDeductionService()
  ) {}

  async generate(businessId: string, opts: AttendanceWeeklyReportOptions): Promise<AttendanceWeeklyReportRow[]> {
    const dailyRows = await this.dailyReportService.generate(businessId, {
      startDate: opts.startDate,
      endDate: opts.endDate,
      departmentId: opts.departmentId,
      employeeId: opts.employeeId,
      audience: opts.audience || "hr",
    });
    return this.aggregate(dailyRows);
  }

  aggregate(dailyRows: AttendanceDailyReportRow[]): AttendanceWeeklyReportRow[] {
    const grouped = new Map<string, AttendanceWeeklyReportRow>();

    for (const daily of dailyRows) {
      const key = keyFor(daily);
      const existing = grouped.get(key) || {
        WeekStartDate: weekStart(daily.Date),
        WeekEndDate: weekEnd(daily.Date),
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
        LatenessNoticesUsed: 0,
        PunctualityRatePercent: 0,
        NetHoursWorked: 0,
        HalfDayDeductions: 0,
        FullDayDeductions: 0,
      };

      const deduction = this.deductionService.calculate(daily);
      const scheduledUnits = Number(daily.ScheduledWorkingDays ?? 1);
      existing.ScheduledWorkDays += scheduledUnits;
      existing.NetHoursWorked += Number(daily.NetHoursWorked || 0);
      existing.HalfDayDeductions += deduction.HalfDayDeductions;
      existing.FullDayDeductions += deduction.FullDayDeductions;

      if (daily.LatenessStatus === "OnTime") existing.DaysOnTime += scheduledUnits;
      if (daily.LatenessStatus === "Late-WithNotice") existing.DaysLateWithNotice += scheduledUnits;
      if (daily.LatenessStatus === "Late-NoNotice") existing.DaysLateNoNotice += scheduledUnits;
      if (daily.LatenessStatus === "Absent") existing.DaysAbsent += scheduledUnits;
      if (daily.LatenessStatus === "IncompletePunch") existing.DaysIncompletePunch += scheduledUnits;
      if (daily.NoticeStatus === "Approved") existing.LatenessNoticesUsed += 1;
      if (daily.LatenessStatus === "Late-WithNotice" && daily.LatenessReasonCode) {
        if (!existing.LatenessNoticesUsedByReason) existing.LatenessNoticesUsedByReason = {};
        existing.LatenessNoticesUsedByReason![daily.LatenessReasonCode] = (existing.LatenessNoticesUsedByReason![daily.LatenessReasonCode] || 0) + 1;
        existing.SicknessUsed = existing.LatenessNoticesUsedByReason.SICKNESS || 0;
        existing.TransportUsed = existing.LatenessNoticesUsedByReason.TRANSPORT || 0;
        existing.FamilyEmergencyUsed = existing.LatenessNoticesUsedByReason.FAMILY_EMERGENCY || 0;
        existing.MedicalAppointmentUsed = existing.LatenessNoticesUsedByReason.MEDICAL_APPOINTMENT || 0;
      }

      existing.PunctualityRatePercent = existing.ScheduledWorkDays
        ? Math.round((existing.DaysOnTime / existing.ScheduledWorkDays) * 100)
        : 0;
      existing.NetHoursWorked = Math.round(existing.NetHoursWorked * 100) / 100;

      grouped.set(key, existing);
    }

    return Array.from(grouped.values()).sort((a, b) =>
      a.WeekStartDate.localeCompare(b.WeekStartDate) || a.EmployeeName.localeCompare(b.EmployeeName)
    );
  }
}
