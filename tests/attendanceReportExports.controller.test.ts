jest.mock("../src/services/attendanceDailyReport.service", () => ({
  AttendanceDailyReportService: jest.fn().mockImplementation(() => ({
    generate: jest.fn().mockResolvedValue([
      {
        EmployeeName: "Marta Bekele",
        Department: "Operations",
        EmploymentCategory: "Non-Managerial",
        AssignedStartTime: "08:30",
        MorningCheckIn: "08:31",
        LunchCheckOut: "12:00",
        LunchCheckIn: "13:00",
        EveningCheckOut: "17:30",
        LunchMinutesTaken: 60,
        NetHoursWorked: 8,
        LatenessStatus: "Late-NoNotice",
        MinutesLate: 1,
        NoticeStatus: "None",
        DeductionApplied: true,
        LatenessReason_HROnly: "HR-only note",
      },
    ]),
  })),
}));

jest.mock("../src/services/attendanceWeeklyReport.service", () => ({
  AttendanceWeeklyReportService: jest.fn().mockImplementation(() => ({
    generate: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock("../src/services/attendanceMonthlyReport.service", () => ({
  AttendanceMonthlyReportService: jest.fn().mockImplementation(() => ({
    generate: jest.fn().mockResolvedValue([]),
  })),
}));

import { AttendanceHrController } from "../src/modules/attendanceHr/attendanceHr.controller";

function resMock() {
  return {
    headers: {} as Record<string, string>,
    statusCode: 0,
    body: "",
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(body: string) {
      this.body = body;
      return this;
    },
  };
}

describe("attendance report exports", () => {
  it("exports daily CSV in approved order for HR users", async () => {
    const controller = new AttendanceHrController();
    const req: any = {
      user: { businessId: "biz-1", roles: ["HR_MANAGER"], permissions: ["attendance.read"] },
      query: { date: "2026-06-22", format: "csv" },
    };
    const res: any = resMock();

    await controller.exportDailyReport(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.split("\n")[0]).toBe("EmployeeName,Department,AssignedStartTime,MorningCheckIn,LunchCheckOut,LunchCheckIn,EveningCheckOut,LunchMinutesTaken,NetHoursWorked,LatenessStatus,MinutesLate,NoticeStatus,DeductionApplied,LatenessReason_HROnly");
    expect(res.body).toContain("HR-only note");
  });

  it("omits HR-only daily column for non-HR attendance readers", async () => {
    const controller = new AttendanceHrController();
    const req: any = {
      user: { businessId: "biz-1", roles: ["EMPLOYEE"], permissions: ["attendance.read"] },
      query: { date: "2026-06-22", format: "csv" },
    };
    const res: any = resMock();

    await controller.exportDailyReport(req, res);

    expect(res.body.split("\n")[0]).not.toContain("LatenessReason_HROnly");
    expect(res.body).not.toContain("HR-only note");
  });
});
