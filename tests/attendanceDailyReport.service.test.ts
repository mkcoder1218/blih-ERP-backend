const mockResolveExpectedEmployees = jest.fn();
const mockAttendanceEventFindAll = jest.fn();
const mockLeaveRequestFindAll = jest.fn();
const mockAttendanceRequestFindAll = jest.fn();
const mockOvertimeRequestFindAll = jest.fn();
const mockLateExplanationFindAll = jest.fn();
const mockDailyReasonFindAll = jest.fn();
const mockLateReasonFindOne = jest.fn();
const mockLateReasonFindAll = jest.fn();
const mockAttendanceRequestCount = jest.fn();

jest.mock("../src/services/attendanceRosterResolver.service", () => ({
  AttendanceRosterResolver: jest.fn().mockImplementation(() => ({
    resolveExpectedEmployees: mockResolveExpectedEmployees,
  })),
}));

jest.mock("../src/models", () => ({
  db: {
    AttendanceEvent: { findAll: mockAttendanceEventFindAll },
    LeaveRequest: { findAll: mockLeaveRequestFindAll },
    AttendanceRequest: { findAll: mockAttendanceRequestFindAll, count: mockAttendanceRequestCount },
    OvertimeRequest: { findAll: mockOvertimeRequestFindAll },
    AttendanceLateExplanation: { findAll: mockLateExplanationFindAll },
    AttendanceDailyReason: { findAll: mockDailyReasonFindAll },
    AttendanceLateReason: { findOne: mockLateReasonFindOne, findAll: mockLateReasonFindAll },
  },
}));

import { AttendanceDailyReportService } from "../src/services/attendanceDailyReport.service";

const BIZ_ID = "biz-1";
const EMP_ID = "emp-1";

function roster(overrides: any = {}) {
  return {
    dateYmd: overrides.dateYmd || "2026-06-22",
    employeeId: overrides.employeeId || EMP_ID,
    employeeName: overrides.employeeName || "Marta Bekele",
    employeeEmail: "marta@example.com",
    department: { id: "dept-1", name: "Operations" },
    assignedStartTime: overrides.assignedStartTime || "08:30",
    employmentCategory: overrides.employmentCategory ?? "Non-Managerial",
    scheduledWorkDays: [1, 2, 3, 4, 5],
    employeeRecord: {},
  };
}

function event(type: string, iso: string, id = type) {
  return {
    id,
    businessId: BIZ_ID,
    employeeId: EMP_ID,
    type,
    timestampUtc: new Date(iso),
  };
}

function setupDb({
  events = [],
  leaves = [],
  notices = [],
  corrections = [],
  overtime = [],
  lateExplanations = [],
  dailyReasons = [],
}: any = {}) {
  mockAttendanceEventFindAll.mockResolvedValue(events);
  mockLeaveRequestFindAll.mockResolvedValue(leaves);
  mockAttendanceRequestFindAll
    .mockResolvedValueOnce(notices)
    .mockResolvedValueOnce(corrections);
  mockOvertimeRequestFindAll.mockResolvedValue(overtime);
  mockLateExplanationFindAll.mockResolvedValue(lateExplanations);
  mockDailyReasonFindAll.mockResolvedValue(dailyReasons);
}

async function generate(audience: "hr" | "public" = "hr") {
  return new AttendanceDailyReportService().generate(BIZ_ID, {
    startDate: "2026-06-22",
    endDate: "2026-06-22",
    audience,
  });
}

describe("AttendanceDailyReportService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveExpectedEmployees.mockResolvedValue([roster()]);
    mockLateReasonFindOne.mockResolvedValue({
      id: "reason-transport",
      reasonCode: "TRANSPORT",
      name: "Transport",
      label: "Transport",
      enabled: true,
      isActive: true,
      monthlyLimit: 3,
      coversMinutes: 60,
      requiresAttachment: false,
      allowAfterDeadline: false,
      behaviorWhenExceeded: "BLOCK",
    });
    mockAttendanceRequestCount.mockResolvedValue(0);
  });

  it("generates a normal on-time row from required punches", async () => {
    setupDb({
      events: [
        event("CHECK_IN", "2026-06-22T05:25:00.000Z"),
        event("LUNCH_OUT", "2026-06-22T09:00:00.000Z"),
        event("LUNCH_IN", "2026-06-22T10:00:00.000Z"),
        event("CHECK_OUT", "2026-06-22T14:30:00.000Z"),
      ],
    });

    const [row] = await generate();

    expect(row).toMatchObject({
      EmployeeName: "Marta Bekele",
      Department: "Operations",
      AssignedStartTime: "08:30",
      MorningCheckIn: "08:25 AM",
      LunchCheckOut: "12:00 PM",
      LunchCheckIn: "01:00 PM",
      EveningCheckOut: "05:30 PM",
      LunchMinutesTaken: 60,
      NetHoursWorked: 8,
      TotalHoursWorked: 8,
      RegularHoursWorked: 8,
      ApprovedOvertimeHours: 0,
      LatenessStatus: "OnTime",
      MinutesLate: 0,
      NoticeStatus: "NotApplicable",
      LatenessNoticesUsedMonth: 0,
      DeductionApplied: false,
    });
  });

  it("marks late with approved notice and keeps HR-only reason for HR payloads", async () => {
    setupDb({
      events: [
        event("CHECK_IN", "2026-06-22T05:45:00.000Z", "check-in-1"),
        event("LUNCH_OUT", "2026-06-22T09:00:00.000Z"),
        event("LUNCH_IN", "2026-06-22T10:00:00.000Z"),
        event("CHECK_OUT", "2026-06-22T14:30:00.000Z"),
      ],
      notices: [{
        id: "notice-1",
        employeeUserId: EMP_ID,
        requestType: "lateness_notice",
        status: "approved",
        validityStatus: "valid",
        submittedAt: new Date("2026-06-22T05:00:00.000Z"),
        approvedAt: new Date("2026-06-22T05:10:00.000Z"),
        deadlineAt: new Date("2026-06-22T06:30:00.000Z"),
        reasonText: "Client errand delayed arrival",
        reasonCategory: "TRANSPORT",
        fromAt: new Date("2026-06-22T05:00:00.000Z"),
        toAt: new Date("2026-06-22T06:00:00.000Z"),
      }],
      lateExplanations: [{ attendanceEventId: "check-in-1", customReason: "Traffic after client errand" }],
    });

    const [row] = await generate();

    expect(row.LatenessStatus).toBe("Late-WithNotice");
    expect(row.MinutesLate).toBe(15);
    expect(row.NoticeStatus).toBe("Approved");
    expect(row.DeductionApplied).toBe(false);
    expect(row.LatenessNoticesUsedMonth).toBe(1);
    expect(row.LatenessReason_HROnly).toBe("Traffic after client errand");
  });

  it("does not let an exhausted reason block another reason category", async () => {
    mockLateReasonFindOne.mockImplementation(async ({ where }: any) => {
      const orKey = Object.getOwnPropertySymbols(where).find((symbol) => String(symbol).includes("or"));
      const code = where.reasonCode || where[orKey as any]?.find((item: any) => item.reasonCode)?.reasonCode;
      return {
        id: `reason-${code}`,
        reasonCode: code,
        name: code,
        label: code,
        enabled: true,
        isActive: true,
        monthlyLimit: code === "TRANSPORT" ? 1 : 2,
        coversMinutes: code === "TRANSPORT" ? 30 : 120,
        requiresAttachment: false,
        allowAfterDeadline: false,
        behaviorWhenExceeded: "BLOCK",
      };
    });
    mockAttendanceRequestCount.mockImplementation(async ({ where }: any) => where.reasonCategory === "TRANSPORT" ? 1 : 0);
    setupDb({
      events: [
        event("CHECK_IN", "2026-06-22T05:45:00.000Z"),
        event("LUNCH_OUT", "2026-06-22T09:00:00.000Z"),
        event("LUNCH_IN", "2026-06-22T10:00:00.000Z"),
        event("CHECK_OUT", "2026-06-22T14:30:00.000Z"),
      ],
      notices: [
        {
          id: "transport-used-up",
          employeeUserId: EMP_ID,
          requestType: "lateness_notice",
          status: "approved",
          validityStatus: "valid",
          submittedAt: new Date("2026-06-22T05:00:00.000Z"),
          approvedAt: new Date("2026-06-22T05:10:00.000Z"),
          deadlineAt: new Date("2026-06-22T06:30:00.000Z"),
          reasonText: "Transport delay from road closure",
          reasonCategory: "TRANSPORT",
          fromAt: new Date("2026-06-22T05:00:00.000Z"),
        },
        {
          id: "family-ok",
          employeeUserId: EMP_ID,
          requestType: "lateness_notice",
          status: "approved",
          validityStatus: "valid",
          submittedAt: new Date("2026-06-22T05:05:00.000Z"),
          approvedAt: new Date("2026-06-22T05:15:00.000Z"),
          deadlineAt: new Date("2026-06-22T06:30:00.000Z"),
          reasonText: "Family emergency required urgent support",
          reasonCategory: "FAMILY_EMERGENCY",
          fromAt: new Date("2026-06-22T05:05:00.000Z"),
        },
      ],
    });

    const [row] = await generate();

    expect(row.LatenessStatus).toBe("Late-WithNotice");
    expect(row.NoticeStatus).toBe("Approved");
    expect(row.LatenessReasonCode).toBe("FAMILY_EMERGENCY");
  });

  it("hides HR-only lateness reason from public payloads, including Telegram-submitted daily reasons", async () => {
    setupDb({
      events: [
        event("CHECK_IN", "2026-06-22T05:45:00.000Z"),
        event("LUNCH_OUT", "2026-06-22T09:00:00.000Z"),
        event("LUNCH_IN", "2026-06-22T10:00:00.000Z"),
        event("CHECK_OUT", "2026-06-22T14:30:00.000Z"),
      ],
      dailyReasons: [{ employeeId: EMP_ID, dateYmd: "2026-06-22", source: "telegram", comment: "Telegram notice" }],
    });

    const [row] = await generate("public");

    expect(row.LatenessStatus).toBe("Late-NoNotice");
    expect(row.NoticeStatus).toBe("None");
    expect(row).not.toHaveProperty("LatenessReason_HROnly");
    expect(row).not.toHaveProperty("LatenessNotice_HROnly");
  });

  it("marks scheduled employee absent when no punches and no approved leave exist", async () => {
    setupDb();

    const [row] = await generate();

    expect(row.LatenessStatus).toBe("Absent");
    expect(row.NetHoursWorked).toBe(0);
    expect(row.DeductionApplied).toBe(true);
  });

  it("does not mark absent or deduct when scheduled employee has approved leave", async () => {
    setupDb({
      leaves: [{
        employeeUserId: EMP_ID,
        leaveType: "annual",
        status: "approved",
        startDate: "2026-06-22",
        endDate: "2026-06-22",
      }],
    });

    const [row] = await generate();

    expect(row.LatenessStatus).toBe("ApprovedLeave");
    expect(row.LeaveCategory).toBe("Annual");
    expect(row.ApprovedLeaveDays).toBe(1);
    expect(row.DeductionApplied).toBe(false);
  });

  it("marks incomplete when a required punch is missing and no approved correction exists", async () => {
    setupDb({
      events: [
        event("CHECK_IN", "2026-06-22T05:25:00.000Z"),
        event("LUNCH_OUT", "2026-06-22T09:00:00.000Z"),
        event("CHECK_OUT", "2026-06-22T14:30:00.000Z"),
      ],
    });

    const [row] = await generate();

    expect(row.LatenessStatus).toBe("IncompletePunch");
    expect(row.LunchCheckIn).toBeNull();
    expect(row.DeductionApplied).toBe(true);
  });

  it("includes approved correction punches like normal punches", async () => {
    setupDb({
      events: [
        event("CHECK_IN", "2026-06-22T05:25:00.000Z"),
        event("LUNCH_OUT", "2026-06-22T09:00:00.000Z"),
        event("CHECK_OUT", "2026-06-22T14:30:00.000Z"),
      ],
      corrections: [{
        id: "correction-1",
        employeeUserId: EMP_ID,
        requestType: "check_in_correction",
        category: "LUNCH_IN",
        status: "approved",
        fromAt: new Date("2026-06-22T10:00:00.000Z"),
      }],
    });

    const [row] = await generate();

    expect(row.LatenessStatus).toBe("OnTime");
    expect(row.LunchCheckIn).toBe("01:00 PM");
    expect(row.NetHoursWorked).toBe(8);
  });

  it("does not count unapproved excess hours as approved overtime", async () => {
    setupDb({
      events: [
        event("CHECK_IN", "2026-06-22T05:30:00.000Z"),
        event("LUNCH_OUT", "2026-06-22T09:00:00.000Z"),
        event("LUNCH_IN", "2026-06-22T10:00:00.000Z"),
        event("CHECK_OUT", "2026-06-22T16:30:00.000Z"),
      ],
    });

    const [row] = await generate();

    expect(row.TotalHoursWorked).toBe(8);
    expect(row.RegularHoursWorked).toBe(8);
    expect(row.ApprovedOvertimeHours).toBe(0);
  });

  it("includes approved overtime beyond standard hours up to approved minutes", async () => {
    setupDb({
      events: [
        event("CHECK_IN", "2026-06-22T05:30:00.000Z"),
        event("LUNCH_OUT", "2026-06-22T09:00:00.000Z"),
        event("LUNCH_IN", "2026-06-22T10:00:00.000Z"),
        event("CHECK_OUT", "2026-06-22T16:30:00.000Z"),
      ],
      overtime: [{
        employeeUserId: EMP_ID,
        requestedDate: "2026-06-22",
        overtimeDate: "2026-06-22",
        status: "closed",
        approvedOvertimeMinutes: 90,
      }],
    });

    const [row] = await generate();

    expect(row.TotalHoursWorked).toBe(9.5);
    expect(row.RegularHoursWorked).toBe(8);
    expect(row.ApprovedOvertimeHours).toBe(1.5);
    expect(mockOvertimeRequestFindAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: "closed" }),
    }));
  });
});
