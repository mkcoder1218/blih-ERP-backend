const mockDailyGenerate = jest.fn();
const mockLeaveFindAll = jest.fn();
const mockBalanceFindAll = jest.fn();

jest.mock("../src/services/attendanceDailyReport.service", () => ({
  AttendanceDailyReportService: jest.fn().mockImplementation(() => ({
    generate: mockDailyGenerate,
  })),
}));

jest.mock("../src/models", () => ({
  db: {
    LeaveRequest: { findAll: mockLeaveFindAll },
    LeaveBalance: { findAll: mockBalanceFindAll },
  },
}));

import { AttendanceMonthlyLeaveReportService } from "../src/services/attendanceMonthlyLeaveReport.service";

describe("AttendanceMonthlyLeaveReportService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDailyGenerate.mockResolvedValue([
      {
        EmployeeId: "emp-1",
        EmployeeName: "Marta Bekele",
        Department: "Operations",
      },
    ]);
  });

  it("calculates monthly leave category usage and annual balance remaining", async () => {
    mockLeaveFindAll
      .mockResolvedValueOnce([
        { employeeUserId: "emp-1", leaveType: "annual", startDate: "2026-06-03", endDate: "2026-06-04" },
        { employeeUserId: "emp-1", leaveType: "sick", startDate: "2026-06-10", endDate: "2026-06-10" },
        { employeeUserId: "emp-1", leaveType: "maternity", startDate: "2026-06-20", endDate: "2026-06-22" },
      ])
      .mockResolvedValueOnce([
        { employeeUserId: "emp-1", leaveType: "annual", startDate: "2026-01-15", endDate: "2026-01-16" },
        { employeeUserId: "emp-1", leaveType: "annual", startDate: "2026-06-03", endDate: "2026-06-04" },
      ]);
    mockBalanceFindAll.mockResolvedValue([{ userId: "emp-1", leaveType: "annual", totalDays: 20 }]);

    const rows = await new AttendanceMonthlyLeaveReportService().generate("biz-1", { month: "2026-06" });

    expect(rows).toEqual([
      {
        Month: "2026-06",
        EmployeeId: "emp-1",
        EmployeeName: "Marta Bekele",
        Department: "Operations",
        AnnualLeaveDaysUsed: 2,
        SickLeaveDaysUsed: 1,
        OtherLeaveDaysUsed: 3,
        AnnualLeaveBalanceRemaining: 16,
      },
    ]);
  });
});
