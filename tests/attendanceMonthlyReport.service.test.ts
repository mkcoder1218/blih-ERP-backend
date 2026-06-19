import { AttendanceMonthlyReportService } from "../src/services/attendanceMonthlyReport.service";
import type { AttendanceDailyReportRow } from "../src/services/attendanceDailyReport.service";

function daily(overrides: Partial<AttendanceDailyReportRow> = {}): AttendanceDailyReportRow {
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
    TotalHoursWorked: 8,
    RegularHoursWorked: 8,
    ApprovedOvertimeHours: 0,
    LatenessStatus: "OnTime",
    MinutesLate: 0,
    NoticeStatus: "NotApplicable",
    LatenessNoticesUsedWeek: 0,
    LatenessNoticesUsedMonth: 0,
    DeductionApplied: false,
    LeaveCategory: null,
    ApprovedLeaveDays: 0,
    ...overrides,
  };
}

describe("AttendanceMonthlyReportService", () => {
  it("aggregates monthly attendance, deduction, leave, and overtime fields", () => {
    const report = new AttendanceMonthlyReportService().aggregate(
      "2026-06",
      [
        daily({ Date: "2026-06-02", LatenessStatus: "OnTime", TotalHoursWorked: 8 }),
        daily({ Date: "2026-06-03", LatenessStatus: "Late-WithNotice", NoticeStatus: "Approved", MinutesLate: 20, TotalHoursWorked: 9.5, ApprovedOvertimeHours: 1.5 }),
        daily({ Date: "2026-06-04", LatenessStatus: "Late-NoNotice", MinutesLate: 75, TotalHoursWorked: 8 }),
        daily({ Date: "2026-06-05", LatenessStatus: "Absent", TotalHoursWorked: 0 }),
        daily({ Date: "2026-06-06", LatenessStatus: "IncompletePunch", TotalHoursWorked: 0 }),
      ],
      [{
        EmployeeId: "emp-1",
        AnnualLeaveDaysUsed: 2,
        SickLeaveDaysUsed: 1,
        OtherLeaveDaysUsed: 3,
        AnnualLeaveBalanceRemaining: 14,
      }],
      [{
        EmployeeId: "emp-1",
        ApprovedOvertimeHours: 1.5,
      }]
    );

    expect(report).toEqual([
      {
        Month: "2026-06",
        EmployeeId: "emp-1",
        EmployeeName: "Marta Bekele",
        Department: "Operations",
        EmploymentCategory: "Non-Managerial",
        ScheduledWorkDays: 5,
        DaysOnTime: 1,
        DaysLateWithNotice: 1,
        DaysLateNoNotice: 1,
        DaysAbsent: 1,
        DaysIncompletePunch: 1,
        PunctualityRatePercent: 20,
        LatenessNoticesUsed: 1,
        TotalMinutesLate: 95,
        TotalHoursWorked: 25.5,
        ApprovedOvertimeHours: 1.5,
        HalfDayDeductions: 1,
        FullDayDeductions: 1,
        DeductedHours: 14,
        AnnualLeaveDaysUsed: 2,
        SickLeaveDaysUsed: 1,
        OtherLeaveDaysUsed: 3,
        AnnualLeaveBalanceRemaining: 14,
        AccountabilityFlag: "Watch",
      },
    ]);
  });

  it("flags managerial, excellent, and good employees", () => {
    const service = new AttendanceMonthlyReportService();

    expect(service.aggregate("2026-06", [daily({ EmploymentCategory: "Managerial" })])[0].AccountabilityFlag).toBe("Mgr-Art61");
    expect(service.aggregate("2026-06", [daily(), daily({ Date: "2026-06-03" })])[0].AccountabilityFlag).toBe("Excellent");
    expect(service.aggregate("2026-06", [
      daily(),
      daily({ Date: "2026-06-03" }),
      daily({ Date: "2026-06-04" }),
      daily({ Date: "2026-06-05", LatenessStatus: "Late-WithNotice", NoticeStatus: "Approved" }),
    ])[0].AccountabilityFlag).toBe("Good");
  });
});
