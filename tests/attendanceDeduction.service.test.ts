import { AttendanceDeductionService, type AttendanceDeductionConfig } from "../src/services/attendanceDeduction.service";
import type { AttendanceDailyReportRow } from "../src/services/attendanceDailyReport.service";

function row(overrides: Partial<AttendanceDailyReportRow> = {}): AttendanceDailyReportRow {
  return {
    Date: "2026-06-22",
    EmployeeId: "emp-1",
    EmployeeName: "Marta Bekele",
    Department: "Operations",
    AssignedStartTime: "08:30",
    EmploymentCategory: "Non-Managerial",
    MorningCheckIn: "08:30",
    LunchCheckOut: "12:00",
    LunchCheckIn: "13:00",
    EveningCheckOut: "17:30",
    LunchMinutesTaken: 60,
    NetHoursWorked: 8,
    LatenessStatus: "OnTime",
    MinutesLate: 0,
    NoticeStatus: "NotApplicable",
    LatenessNoticesUsedWeek: 0,
    LatenessNoticesUsedMonth: 0,
    DeductionApplied: false,
    ...overrides,
  };
}

describe("AttendanceDeductionService", () => {
  it("exempts managerial employees with Exempt-Art61", () => {
    const result = new AttendanceDeductionService().calculate(row({
      EmploymentCategory: "Managerial",
      LatenessStatus: "Absent",
    }));

    expect(result.DeductionLabel).toBe("Exempt-Art61");
    expect(result.DeductedHours).toBe(0);
  });

  it("applies FullDay for non-managerial absence without approved leave", () => {
    const result = new AttendanceDeductionService().calculate(row({ LatenessStatus: "Absent" }));

    expect(result).toMatchObject({
      DeductionLabel: "FullDay",
      FullDayDeductions: 1,
      DeductedHours: 8,
    });
  });

  it("applies configurable incomplete punch deduction", () => {
    const config: AttendanceDeductionConfig = {
      incompletePunchDeduction: "2hr",
      lateNoNoticeRules: [{ minMinutesLate: 1, deduction: "1hr" }],
      noticeCapExceededDeduction: "1hr",
      monthlyApprovedNoticeCap: 3,
    };

    const result = new AttendanceDeductionService(config).calculate(row({ LatenessStatus: "IncompletePunch", NoticeStatus: "None" }));

    expect(result.DeductionLabel).toBe("2hr");
    expect(result.DeductedHours).toBe(2);
  });

  it("applies late no notice thresholds", () => {
    const service = new AttendanceDeductionService();

    expect(service.calculate(row({ LatenessStatus: "Late-NoNotice", MinutesLate: 20 })).DeductionLabel).toBe("1hr");
    expect(service.calculate(row({ LatenessStatus: "Late-NoNotice", MinutesLate: 90 })).DeductionLabel).toBe("2hr");
    expect(service.calculate(row({ LatenessStatus: "Late-NoNotice", MinutesLate: 150 })).DeductionLabel).toBe("HalfDay");
  });

  it("applies half-day penalty when an approved reason exceeds its covered minutes", () => {
    const result = new AttendanceDeductionService().calculate(row({
      LatenessStatus: "Late-NoNotice",
      NoticeStatus: "Invalid",
      MinutesLate: 65,
      PenaltyOverride: "HalfDay",
      PenaltyReason: "Lateness exceeded the approved reason coverage.",
    }));

    expect(result.DeductionLabel).toBe("HalfDay");
    expect(result.HalfDayDeductions).toBe(1);
    expect(result.DeductedHours).toBe(4);
  });

  it("does not deduct Late-WithNotice unless monthly cap is exceeded", () => {
    const service = new AttendanceDeductionService();

    expect(service.calculate(row({ LatenessStatus: "Late-WithNotice", NoticeStatus: "Approved", LatenessNoticesUsedMonth: 3 })).DeductionLabel).toBe("None");
    expect(service.calculate(row({ LatenessStatus: "Late-WithNotice", NoticeStatus: "Approved", LatenessNoticesUsedMonth: 4 })).DeductionLabel).toBe("1hr");
  });

  it("calculates aggregate half-day, full-day, and deducted hours totals", () => {
    const result = new AttendanceDeductionService().calculateMany([
      row({ LatenessStatus: "IncompletePunch" }),
      row({ LatenessStatus: "Absent" }),
      row({ LatenessStatus: "Late-NoNotice", MinutesLate: 65 }),
    ]);

    expect(result.totals).toEqual({
      HalfDayDeductions: 1,
      FullDayDeductions: 1,
      DeductedHours: 14,
    });
  });
});
