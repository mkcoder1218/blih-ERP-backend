const mockDailyGenerate = jest.fn();

jest.mock("../src/services/attendanceDailyReport.service", () => ({
  AttendanceDailyReportService: jest.fn().mockImplementation(() => ({
    generate: mockDailyGenerate,
  })),
}));

import { AttendanceMonthlyOvertimeReportService } from "../src/services/attendanceMonthlyOvertimeReport.service";

describe("AttendanceMonthlyOvertimeReportService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("aggregates total, regular, and approved overtime hours from daily report rows", async () => {
    mockDailyGenerate.mockResolvedValue([
      {
        EmployeeId: "emp-1",
        EmployeeName: "Marta Bekele",
        Department: "Operations",
        TotalHoursWorked: 9.5,
        RegularHoursWorked: 8,
        ApprovedOvertimeHours: 1.5,
      },
      {
        EmployeeId: "emp-1",
        EmployeeName: "Marta Bekele",
        Department: "Operations",
        TotalHoursWorked: 8,
        RegularHoursWorked: 8,
        ApprovedOvertimeHours: 0,
      },
    ]);

    const rows = await new AttendanceMonthlyOvertimeReportService().generate("biz-1", { month: "2026-06" });

    expect(rows).toEqual([
      {
        Month: "2026-06",
        EmployeeId: "emp-1",
        EmployeeName: "Marta Bekele",
        Department: "Operations",
        TotalHoursWorked: 17.5,
        RegularHours: 16,
        ApprovedOvertimeHours: 1.5,
      },
    ]);
  });
});
