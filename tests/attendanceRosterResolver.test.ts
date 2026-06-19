const mockEmployeeFindAll = jest.fn();

jest.mock("../src/models", () => ({
  db: {
    EmployeeRecord: { findAll: mockEmployeeFindAll },
    User: {},
    Department: {},
  },
}));

import { AttendanceRosterResolver } from "../src/services/attendanceRosterResolver.service";

function employee(overrides: any = {}) {
  return {
    userId: overrides.userId || "user-1",
    assignedStartTime: overrides.assignedStartTime ?? "08:30",
    employmentCategory: Object.prototype.hasOwnProperty.call(overrides, "employmentCategory") ? overrides.employmentCategory : "Managerial",
    scheduledWorkDays: overrides.scheduledWorkDays ?? [1, 3],
    employmentType: overrides.employmentType || "full_time",
    user: {
      id: overrides.userId || "user-1",
      fullName: overrides.fullName || "Ada Lovelace",
      email: overrides.email || "ada@example.com",
      status: "active",
    },
    department: overrides.department ?? { id: "dept-1", name: "Engineering" },
  };
}

describe("AttendanceRosterResolver", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns scheduled employee days from roster fields, not punches", async () => {
    mockEmployeeFindAll.mockResolvedValue([employee()]);

    const rows = await new AttendanceRosterResolver().resolveExpectedEmployees("biz-1", {
      startDate: "2026-06-22",
      endDate: "2026-06-26",
    });

    expect(mockEmployeeFindAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { businessId: "biz-1", employmentStatus: "active" },
    }));
    expect(rows.map((row) => row.dateYmd)).toEqual(["2026-06-22", "2026-06-24"]);
    expect(rows[0]).toMatchObject({
      employeeId: "user-1",
      employeeName: "Ada Lovelace",
      assignedStartTime: "08:30",
      employmentCategory: "Managerial",
      scheduledWorkDays: [1, 3],
      department: { id: "dept-1", name: "Engineering" },
    });
  });

  it("filters by department and employee when requested", async () => {
    mockEmployeeFindAll.mockResolvedValue([employee({ userId: "user-2", scheduledWorkDays: [5] })]);

    await new AttendanceRosterResolver().resolveExpectedEmployees("biz-1", {
      startDate: "2026-06-26",
      endDate: "2026-06-26",
      departmentId: "dept-2",
      employeeId: "user-2",
    });

    expect(mockEmployeeFindAll).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        businessId: "biz-1",
        employmentStatus: "active",
        departmentId: "dept-2",
        userId: "user-2",
      },
    }));
  });

  it("does not infer employment category when HR has not set it", async () => {
    mockEmployeeFindAll.mockResolvedValue([employee({ employmentCategory: null, scheduledWorkDays: [1] })]);

    const rows = await new AttendanceRosterResolver().resolveExpectedEmployees("biz-1", {
      startDate: "2026-06-22",
      endDate: "2026-06-22",
    });

    expect(rows[0].employmentCategory).toBeNull();
  });
});
