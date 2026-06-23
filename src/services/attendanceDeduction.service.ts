import type { AttendanceDailyReportRow } from "./attendanceDailyReport.service";

export type AttendanceDeductionLabel = "None" | "1hr" | "2hr" | "HalfDay" | "FullDay" | "Exempt-Art61";

export type AttendanceDeductionConfig = {
  incompletePunchDeduction: Exclude<AttendanceDeductionLabel, "None" | "FullDay" | "Exempt-Art61">;
  noticeCapExceededDeduction: Exclude<AttendanceDeductionLabel, "FullDay" | "Exempt-Art61">;
  monthlyApprovedNoticeCap: number;
};

export type AttendanceDeductionResult = {
  Date: string;
  EmployeeId: string;
  EmployeeName: string;
  EmploymentCategory: "Managerial" | "Non-Managerial" | null;
  DeductionLabel: AttendanceDeductionLabel;
  HalfDayDeductions: number;
  FullDayDeductions: number;
  DeductedHours: number;
  Reason: string;
};

export const DEFAULT_ATTENDANCE_DEDUCTION_CONFIG: AttendanceDeductionConfig = {
  incompletePunchDeduction: "HalfDay",
  noticeCapExceededDeduction: "1hr",
  monthlyApprovedNoticeCap: 3,
};

function hoursForLabel(label: AttendanceDeductionLabel) {
  if (label === "1hr") return 1;
  if (label === "2hr") return 2;
  if (label === "HalfDay") return 4;
  if (label === "FullDay") return 8;
  return 0;
}

function halfDaysForLabel(label: AttendanceDeductionLabel) {
  return label === "HalfDay" ? 1 : 0;
}

function fullDaysForLabel(label: AttendanceDeductionLabel) {
  return label === "FullDay" ? 1 : 0;
}

function lateNoNoticeDeduction(row: AttendanceDailyReportRow) {
  const graceMinutes = Math.max(0, Number(row.LateNoReasonPenaltyGraceMinutes ?? 0));
  return row.MinutesLate > graceMinutes ? "HalfDay" : "None";
}

export class AttendanceDeductionService {
  constructor(private readonly config: AttendanceDeductionConfig = DEFAULT_ATTENDANCE_DEDUCTION_CONFIG) {}

  calculate(row: AttendanceDailyReportRow): AttendanceDeductionResult {
    const label = this.resolveLabel(row);
    return {
      Date: row.Date,
      EmployeeId: row.EmployeeId,
      EmployeeName: row.EmployeeName,
      EmploymentCategory: row.EmploymentCategory,
      DeductionLabel: label,
      HalfDayDeductions: halfDaysForLabel(label),
      FullDayDeductions: fullDaysForLabel(label),
      DeductedHours: hoursForLabel(label),
      Reason: this.reasonFor(row, label),
    };
  }

  calculateMany(rows: AttendanceDailyReportRow[]) {
    const results = rows.map((row) => this.calculate(row));
    return {
      rows: results,
      totals: {
        HalfDayDeductions: results.reduce((sum, row) => sum + row.HalfDayDeductions, 0),
        FullDayDeductions: results.reduce((sum, row) => sum + row.FullDayDeductions, 0),
        DeductedHours: results.reduce((sum, row) => sum + row.DeductedHours, 0),
      },
    };
  }

  private resolveLabel(row: AttendanceDailyReportRow): AttendanceDeductionLabel {
    if (row.EmploymentCategory === "Managerial") return "Exempt-Art61";
    if (row.PenaltyOverride === "HalfDay") return "HalfDay";
    if (row.LatenessStatus === "ApprovedLeave") return "None";
    if (row.LatenessStatus === "Absent") return "FullDay";
    if (row.LatenessStatus === "IncompletePunch") return row.NoticeStatus === "Approved" ? "None" : this.config.incompletePunchDeduction;
    if (row.LatenessStatus === "Late-NoNotice") return lateNoNoticeDeduction(row);
    if (row.LatenessStatus === "Late-WithNotice") {
      return row.LatenessNoticesUsedMonth > this.config.monthlyApprovedNoticeCap ? this.config.noticeCapExceededDeduction : "None";
    }
    return "None";
  }

  private reasonFor(row: AttendanceDailyReportRow, label: AttendanceDeductionLabel) {
    if (label === "Exempt-Art61") return "Managerial employee exempt from automatic attendance deductions.";
    if (row.PenaltyOverride === "HalfDay") return row.PenaltyReason || "Lateness exceeded the approved reason coverage.";
    if (label === "FullDay") return "Scheduled employee absent without approved leave.";
    if (row.LatenessStatus === "IncompletePunch" && label !== "None") return "Required punch missing without approved correction.";
    if (row.LatenessStatus === "Late-NoNotice" && label !== "None") return `Late check-in without approved valid notice after ${Number(row.LateNoReasonPenaltyGraceMinutes ?? 0)} minute penalty window.`;
    if (row.LatenessStatus === "Late-WithNotice" && label !== "None") return "Approved lateness notice monthly cap exceeded.";
    return "No automatic deduction.";
  }
}
