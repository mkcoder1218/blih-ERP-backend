const mockFindOne = jest.fn();
const mockCreate = jest.fn();
const mockCount = jest.fn();

jest.mock("../src/models", () => ({
  db: {
    AttendanceRequest: {
      findOne: mockFindOne,
      create: mockCreate,
      count: mockCount,
    },
    AttendanceLateReason: {
      findOne: jest.fn().mockResolvedValue({
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
      }),
      findAll: jest.fn(),
    },
    BusinessAttendanceSettings: { findOne: jest.fn().mockResolvedValue({ timezone: "Africa/Addis_Ababa" }) },
    AttendanceEvent: { findOne: jest.fn(), create: jest.fn() },
    User: { findOne: jest.fn() },
  },
}));

import { AttendanceRequestsService } from "../src/modules/attendanceRequests/attendanceRequests.service";

describe("lateness notice approval logic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates invalid pending notice when reason is vague", async () => {
    mockCreate.mockImplementation(async (payload) => payload);
    const record = await new AttendanceRequestsService().create("biz-1", "user-1", {
      requestType: "lateness_notice",
      title: "Late notice",
      reason: "traffic",
      fromAt: "2026-06-22T08:45",
    });

    expect(record).toMatchObject({
      requestType: "lateness_notice",
      status: "pending",
      validityStatus: "invalid",
      reasonText: "traffic",
    });
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
