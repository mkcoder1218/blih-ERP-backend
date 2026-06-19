import { AttendanceWeeklyReportService } from "../src/services/attendanceWeeklyReport.service";
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
    LatenessStatus: "OnTime",
    MinutesLate: 0,
    NoticeStatus: "NotApplicable",
    LatenessNoticesUsedWeek: 0,
    LatenessNoticesUsedMonth: 0,
    DeductionApplied: false,
    ...overrides,
  };
}

describe("AttendanceWeeklyReportService", () => {
  it("aggregates one row per employee per week from daily report rows", () => {
    const rows = new AttendanceWeeklyReportService().aggregate([
      daily({ Date: "2026-06-22", LatenessStatus: "OnTime", NetHoursWorked: 8 }),
      daily({ Date: "2026-06-23", LatenessStatus: "Late-WithNotice", NoticeStatus: "Approved", NetHoursWorked: 7.5 }),
      daily({ Date: "2026-06-24", LatenessStatus: "Late-NoNotice", MinutesLate: 75, NetHoursWorked: 8 }),
      daily({ Date: "2026-06-25", LatenessStatus: "Absent", NetHoursWorked: 0 }),
      daily({ Date: "2026-06-26", LatenessStatus: "IncompletePunch", NetHoursWorked: 0 }),
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      WeekStartDate: "2026-06-22",
      WeekEndDate: "2026-06-28",
      EmployeeName: "Marta Bekele",
      Department: "Operations",
      ScheduledWorkDays: 5,
      DaysOnTime: 1,
      DaysLateWithNotice: 1,
      DaysLateNoNotice: 1,
      DaysAbsent: 1,
      DaysIncompletePunch: 1,
      LatenessNoticesUsed: 1,
      PunctualityRatePercent: 20,
      NetHoursWorked: 23.5,
      HalfDayDeductions: 1,
      FullDayDeductions: 1,
    });
  });

  it("keeps scheduled zero-punch days because daily report already includes roster days", () => {
    const rows = new AttendanceWeeklyReportService().aggregate([
      daily({ Date: "2026-06-22", EmployeeId: "emp-1", EmployeeName: "Marta Bekele", LatenessStatus: "Absent", NetHoursWorked: 0 }),
      daily({ Date: "2026-06-23", EmployeeId: "emp-1", EmployeeName: "Marta Bekele", LatenessStatus: "Absent", NetHoursWorked: 0 }),
    ]);

    expect(rows[0]).toMatchObject({
      ScheduledWorkDays: 2,
      DaysAbsent: 2,
      NetHoursWorked: 0,
      FullDayDeductions: 2,
    });
  });
});
