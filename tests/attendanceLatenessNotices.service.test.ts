const mockFindOne = jest.fn();
const mockCreate = jest.fn();
const mockCount = jest.fn();
const mockUserFindOne = jest.fn().mockResolvedValue({ id: "user-2" });
const mockLateReasonFindOne = jest.fn().mockResolvedValue({
  id: "reason-1",
  reasonCode: "TRANSPORT",
  name: "Transport",
  label: "Transport",
  enabled: true,
  isActive: true,
  monthlyLimit: 1,
  coversMinutes: 30,
  requiresAttachment: false,
  allowAfterDeadline: false,
  behaviorWhenExceeded: "BLOCK",
});

jest.mock("../src/models", () => ({
  db: {
    AttendanceRequest: {
      findOne: mockFindOne,
      create: mockCreate,
      count: mockCount,
    },
    AttendanceLateReason: {
      findOne: mockLateReasonFindOne,
      findAll: jest.fn(),
    },
    BusinessAttendanceSettings: { findOne: jest.fn().mockResolvedValue({ timezone: "Africa/Addis_Ababa" }) },
    BusinessSetting: { findOne: jest.fn().mockResolvedValue(null), create: jest.fn() },
    AttendanceEvent: { findOne: jest.fn(), create: jest.fn() },
    User: { findOne: mockUserFindOne },
  },
}));

import { AttendanceRequestsService } from "../src/modules/attendanceRequests/attendanceRequests.service";

describe("lateness notice approval logic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLateReasonFindOne.mockResolvedValue({
      id: "reason-1",
      reasonCode: "TRANSPORT",
      name: "Transport",
      label: "Transport",
      enabled: true,
      isActive: true,
      monthlyLimit: 1,
      coversMinutes: 30,
      requiresAttachment: false,
      allowAfterDeadline: false,
      behaviorWhenExceeded: "BLOCK",
    });
    mockUserFindOne.mockResolvedValue({ id: "user-2" });
  });

  it("creates invalid pending notice when reason is vague", async () => {
    mockCreate.mockImplementation(async (payload) => payload);
    const record = await new AttendanceRequestsService().create("biz-1", "user-1", {
      requestType: "lateness_notice",
      title: "Late notice",
      reason: "traffic",
      fromAt: "2099-06-22T08:00",
    });

    expect(record).toMatchObject({
      requestType: "lateness_notice",
      status: "pending",
      validityStatus: "invalid",
      reasonText: "traffic",
    });
  });

  it("looks up non-uuid lateness reason codes without comparing them to the uuid id column", async () => {
    mockCreate.mockImplementation(async (payload) => payload);
    await new AttendanceRequestsService().create("biz-1", "user-1", {
      requestType: "lateness_notice",
      title: "Late notice",
      reason: "Car accident blocked the road",
      reasonCategory: "CAR_ACCIDENT",
      fromAt: "2026-06-22T08:00",
    });

    const where = mockLateReasonFindOne.mock.calls[0][0].where;
    const orKey = Object.getOwnPropertySymbols(where).find((symbol) => String(symbol).includes("or"));

    expect(where[orKey as any]).toEqual([{ reasonCode: "CAR_ACCIDENT" }]);
  });

  it("auto-approves managed manual lateness notices for another employee", async () => {
    mockCreate.mockImplementation(async (payload) => payload);
    const record = await new AttendanceRequestsService().create("biz-1", "admin-1", {
      requestType: "lateness_notice",
      employeeUserId: "user-2",
      title: "Manual lateness reason",
      reason: "Network issue prevented normal employee submission",
      reasonCategory: "TRANSPORT",
      fromAt: "2099-06-22T08:00",
    }, { canManage: true });

    expect(record).toMatchObject({
      employeeUserId: "user-2",
      requestType: "lateness_notice",
      status: "approved",
      validityStatus: "valid",
      approvedByUserId: "admin-1",
    });
    expect(mockCount).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ employeeUserId: "user-2" }),
    }));
  });

  it("rejects approval when the selected reason monthly cap is reached", async () => {
    const update = jest.fn();
    mockFindOne.mockResolvedValue({
      id: "notice-1",
      businessId: "biz-1",
      employeeUserId: "user-1",
      requestType: "lateness_notice",
      status: "pending",
      validityStatus: "valid",
      reasonText: "Medical appointment delayed arrival",
      reasonCategory: "TRANSPORT",
      fromAt: new Date("2026-06-22T05:45:00.000Z"),
      submittedAt: new Date("2026-06-22T05:20:00.000Z"),
      deadlineAt: new Date("2026-06-22T06:30:00.000Z"),
      update,
    });
    mockCount.mockResolvedValue(1);

    await expect(new AttendanceRequestsService().action("biz-1", "notice-1", "hr-1", "approved")).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("Monthly limit reached"),
    });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ validityStatus: "invalid" }));
  });
});
