const mockFindPaginated = jest.fn();
const mockFindById = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockFindActiveForEmployeeDate = jest.fn();
const mockNotifierSend = jest.fn();

jest.mock("../src/modules/overtime/overtime.dal", () => ({
  OvertimeDAL: jest.fn().mockImplementation(() => ({
    findPaginated: mockFindPaginated,
    findById: mockFindById,
    create: mockCreate,
    update: mockUpdate,
    findActiveForEmployeeDate: mockFindActiveForEmployeeDate,
  })),
}));

jest.mock("../src/modules/notification/notification.service", () => ({
  InternalNotifier: { send: mockNotifierSend },
}));

jest.mock("../src/models", () => ({
  db: {
    Role: { findAll: jest.fn().mockResolvedValue([]) },
    UserRole: { findAll: jest.fn().mockResolvedValue([]) },
  },
}));

import { OvertimeService } from "../src/modules/overtime/overtime.service";

const BIZ_ID = "biz-1";
const EMP_ID = "emp-1";
const MANAGER_ID = "manager-1";

describe("OvertimeService lifecycle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date("2026-06-22T15:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("creates an employee overtime request without employee overtime check-in fields", async () => {
    mockFindActiveForEmployeeDate.mockResolvedValue(null);
    mockCreate.mockImplementation(async (payload) => ({ id: "ot-1", ...payload }));

    const record = await new OvertimeService().submit(BIZ_ID, EMP_ID, {
      requestedDate: "2026-06-22",
      reason: "Month-end reconciliation support",
      expectedDurationMinutes: 120,
    });

    expect(record).toMatchObject({
      employeeUserId: EMP_ID,
      requestedDate: "2026-06-22",
      overtimeDate: "2026-06-22",
      expectedDurationMinutes: 120,
      status: "pending",
      totalMinutes: 0,
      requestedBy: EMP_ID,
    });
    expect(record.startTime).toBeNull();
    expect(mockFindActiveForEmployeeDate).toHaveBeenCalledWith(BIZ_ID, EMP_ID, "2026-06-22");
  });

  it("prevents duplicate active overtime requests for the same employee and date", async () => {
    mockFindActiveForEmployeeDate.mockResolvedValue({ id: "existing-ot" });

    await expect(new OvertimeService().submit(BIZ_ID, EMP_ID, {
      requestedDate: "2026-06-22",
      reason: "Month-end reconciliation support",
      expectedDurationMinutes: 120,
    })).rejects.toThrow("Duplicate active overtime request");
  });

  it("manager approval starts overtime at approval time", async () => {
    mockFindById
      .mockResolvedValueOnce({ id: "ot-1", businessId: BIZ_ID, employeeUserId: EMP_ID, status: "pending" })
      .mockResolvedValueOnce({ id: "ot-1", status: "approved" });

    await new OvertimeService().approve("ot-1", BIZ_ID, MANAGER_ID, "department_head", "Approved");

    expect(mockUpdate).toHaveBeenCalledWith("ot-1", BIZ_ID, expect.objectContaining({
      status: "approved",
      approvalStage: "approved",
      approvedBy: MANAGER_ID,
      approvedAtUtc: new Date("2026-06-22T15:00:00.000Z"),
      overtimeStartedAtUtc: new Date("2026-06-22T15:00:00.000Z"),
    }));
  });

  it("does not approve already approved, closed, rejected, or cancelled requests", async () => {
    mockFindById.mockResolvedValue({ id: "ot-1", status: "approved" });

    await expect(new OvertimeService().approve("ot-1", BIZ_ID, MANAGER_ID, "department_head")).rejects.toThrow("Request is not pending");
  });

  it("manager close ends overtime and stores approved minutes", async () => {
    jest.setSystemTime(new Date("2026-06-22T17:30:00.000Z"));
    mockFindById
      .mockResolvedValueOnce({
        id: "ot-1",
        businessId: BIZ_ID,
        employeeUserId: EMP_ID,
        status: "approved",
        overtimeStartedAtUtc: new Date("2026-06-22T15:00:00.000Z"),
      })
      .mockResolvedValueOnce({ id: "ot-1", status: "closed" });

    await new OvertimeService().close("ot-1", BIZ_ID, MANAGER_ID);

    expect(mockUpdate).toHaveBeenCalledWith("ot-1", BIZ_ID, expect.objectContaining({
      status: "closed",
      approvalStage: "closed",
      closedBy: MANAGER_ID,
      overtimeClosedAtUtc: new Date("2026-06-22T17:30:00.000Z"),
      approvedOvertimeMinutes: 150,
      totalMinutes: 150,
    }));
  });

  it("does not close overtime before approval", async () => {
    mockFindById.mockResolvedValue({ id: "ot-1", status: "pending" });

    await expect(new OvertimeService().close("ot-1", BIZ_ID, MANAGER_ID)).rejects.toThrow("Only approved overtime requests can be closed");
  });

  it("allows employees to cancel only pending own requests", async () => {
    mockFindById
      .mockResolvedValueOnce({ id: "ot-1", employeeUserId: EMP_ID, status: "pending" })
      .mockResolvedValueOnce({ id: "ot-1", status: "cancelled" });

    await new OvertimeService().cancel("ot-1", BIZ_ID, EMP_ID);

    expect(mockUpdate).toHaveBeenCalledWith("ot-1", BIZ_ID, {
      status: "cancelled",
      approvalStage: "cancelled",
    });
  });
});
