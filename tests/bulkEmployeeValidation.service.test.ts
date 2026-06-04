import { BulkEmployeeValidationService } from "../src/modules/hr/bulkEmployeeValidation.service";
import { db } from "../src/models";

jest.mock("../src/models", () => ({
  db: {
    Role: { findAll: jest.fn() },
    sequelize: { transaction: jest.fn() },
    User: { findAll: jest.fn(), findOne: jest.fn(), create: jest.fn() },
    Department: { findAll: jest.fn(), findOne: jest.fn() },
    Position: { findAll: jest.fn(), findOne: jest.fn() },
    EmployeeRecord: { findAll: jest.fn(), findOne: jest.fn(), create: jest.fn(), update: jest.fn() },
  },
}));

const businessA = "business-a";
const businessB = "business-b";

const baseRow = (overrides: any = {}) => ({
  rowNumber: overrides.rowNumber ?? 1,
  ...(overrides.action ? { action: overrides.action } : {}),
  ...(overrides.employeeId ? { employeeId: overrides.employeeId } : {}),
  account: {
    firstName: "Alice",
    lastName: "Worker",
    email: "alice@example.com",
    phone: " +251900000000 ",
    password: "secret",
    ...(overrides.account || {}),
  },
  profile: {
    employeeCode: "EMP-100",
    roleKeys: ["EMPLOYEE", "EMPLOYEE"],
    departmentName: "Engineering",
    positionName: "Engineer",
    managerEmail: "manager@example.com",
    employmentType: "full_time",
    employmentStatus: "active",
    hireDate: "2024-01-01",
    contractStartDate: "2024-01-01",
    contractEndDate: "2025-01-01",
    monthlySalary: 1000,
    salaryCurrency: "ETB",
    ...(overrides.profile || {}),
  },
});

function makeDb(seed: any = {}) {
  const roles = seed.roles ?? [{ businessId: businessA, key: "EMPLOYEE" }];
  const departments = seed.departments ?? [{ businessId: businessA, key: "engineering", name: "Engineering", id: "dept-1" }];
  const positions = seed.positions ?? [{ businessId: businessA, id: "pos-1", key: "engineer", title: "Engineer", departmentId: "dept-1" }];
  const managers = seed.managers ?? [{ businessId: businessA, id: "manager-1", email: "manager@example.com" }];
  const records = seed.records ?? [];
  const users = seed.users ?? [];

  (db.Role.findAll as jest.Mock).mockImplementation(({ where }: any = {}) => {
    const keys = where?.key;
    return Promise.resolve(roles.filter((r: any) => (r.businessId === businessA || r.businessId === null) && (!keys || keys.includes(r.key))));
  });
  (db.Department.findAll as jest.Mock).mockResolvedValue(departments.filter((d: any) => d.businessId === businessA));
  (db.Department.findOne as jest.Mock).mockImplementation(({ where }: any) => Promise.resolve(departments.find((d: any) => d.businessId === where.businessId && (d.key === where.key || d.name === where.name)) || null));
  (db.Position.findAll as jest.Mock).mockResolvedValue(positions.filter((p: any) => p.businessId === businessA));
  (db.Position.findOne as jest.Mock).mockImplementation(({ where }: any) => Promise.resolve(positions.find((p: any) => p.businessId === where.businessId && (p.id === where.id || p.title === where.title)) || null));
  (db.User.findAll as jest.Mock).mockImplementation(({ where, include }: any) => {
    if (include) return Promise.resolve(users.filter((u: any) => u.businessId === businessA));
    return Promise.resolve(managers.filter((u: any) => u.businessId === businessA && (!where?.email || where.email.includes(u.email))));
  });
  (db.User.findOne as jest.Mock).mockImplementation(({ where }: any) => Promise.resolve(managers.find((u: any) => u.businessId === where.businessId && u.email === where.email) || null));
  (db.EmployeeRecord.findAll as jest.Mock).mockResolvedValue(records.filter((r: any) => r.businessId === businessA));
  (db.EmployeeRecord.findOne as jest.Mock).mockImplementation(({ where }: any) => Promise.resolve(records.find((r: any) => r.businessId === where.businessId && r.id === where.id) || null));
  (db.sequelize.transaction as jest.Mock).mockResolvedValue({ commit: jest.fn(), rollback: jest.fn() });
  (db.User.create as jest.Mock).mockResolvedValue({ id: "new-user", setRoles: jest.fn() });
  (db.EmployeeRecord.create as jest.Mock).mockResolvedValue({ id: "new-rec", employeeCode: "EMP-100" });
}

describe("BulkEmployeeValidationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    makeDb();
  });

  it("detects rows ready to create and normalizes values", async () => {
    const result = await new BulkEmployeeValidationService().validate(businessA, [
      baseRow({ account: { email: " ALICE@EXAMPLE.COM " } }),
    ]);

    expect(result.summary.READY_TO_CREATE).toBe(1);
    expect(result.results[0].status).toBe("READY_TO_CREATE");
    expect(result.results[0].normalizedRow?.account.email).toBe("alice@example.com");
    expect(result.results[0].normalizedRow?.profile.roleKeys).toEqual(["EMPLOYEE"]);
  });

  it("returns one invalid row and one valid row in the same upload", async () => {
    const result = await new BulkEmployeeValidationService().validate(businessA, [
      baseRow({ rowNumber: 1, account: { email: "not-an-email" } }),
      baseRow({ rowNumber: 2, account: { email: "valid@example.com" }, profile: { employeeCode: "EMP-101" } }),
    ]);

    expect(result.results).toHaveLength(2);
    expect(result.results[0].status).toBe("INVALID");
    expect(result.results[0].errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "account.email", message: "email must be valid" }),
    ]));
    expect(result.results[1].status).toBe("READY_TO_CREATE");
  });

  it("accepts EMPLOYEE role key", async () => {
    const result = await new BulkEmployeeValidationService().validate(businessA, [
      baseRow({ profile: { roleKeys: ["EMPLOYEE"] } }),
    ]);

    expect(result.results[0].status).toBe("READY_TO_CREATE");
    expect(result.results[0].normalizedRow?.profile.roleKeys).toEqual(["EMPLOYEE"]);
  });

  it("accepts multiple role keys separated by CSV parsing into roleKeys", async () => {
    makeDb({ roles: [{ businessId: businessA, key: "EMPLOYEE" }, { businessId: businessA, key: "HR_MANAGER" }] });

    const result = await new BulkEmployeeValidationService().validate(businessA, [
      baseRow({ profile: { roleKeys: ["EMPLOYEE", "HR_MANAGER"] } }),
    ]);

    expect(result.results[0].status).toBe("READY_TO_CREATE");
    expect(result.results[0].normalizedRow?.profile.roleKeys).toEqual(["EMPLOYEE", "HR_MANAGER"]);
  });

  it("converts lowercase role input to uppercase before validation and lookup", async () => {
    makeDb({ roles: [{ businessId: businessA, key: "EMPLOYEE" }, { businessId: businessA, key: "HR_MANAGER" }] });

    const result = await new BulkEmployeeValidationService().validate(businessA, [
      baseRow({ profile: { roleKeys: [" employee ", "hr_manager"] } }),
    ]);

    expect(result.results[0].status).toBe("READY_TO_CREATE");
    expect(result.results[0].normalizedRow?.profile.roleKeys).toEqual(["EMPLOYEE", "HR_MANAGER"]);
    expect(db.Role.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ key: ["EMPLOYEE", "HR_MANAGER"] }),
    }));
  });

  it("rejects invalid bulk role values", async () => {
    const result = await new BulkEmployeeValidationService().validate(businessA, [
      baseRow({ profile: { roleKeys: ["sales_agent", "finance_officer", "support_agent", "contractor"] } }),
    ]);

    expect(result.results[0].status).toBe("INVALID");
    expect(result.results[0].errors.map((error) => error.message)).toEqual(expect.arrayContaining([
      'Role key "SALES_AGENT" is not allowed for bulk employee import',
      'Role key "FINANCE_OFFICER" is not allowed for bulk employee import',
      'Role key "SUPPORT_AGENT" is not allowed for bulk employee import',
      'Role key "CONTRACTOR" is not allowed for bulk employee import',
    ]));
  });

  it("detects updates and returns changed fields without password changes", async () => {
    makeDb({
      records: [{
        id: "rec-1",
        businessId: businessA,
        userId: "user-1",
        employeeCode: "EMP-100",
        departmentId: "dept-1",
        positionId: "pos-1",
        managerUserId: "manager-1",
        employmentType: "full_time",
        employmentStatus: "active",
        hireDate: "2024-01-01",
        contractStartDate: "2024-01-01",
        contractEndDate: "2025-01-01",
        salaryInfo: { baseSalary: 1000, currency: "ETB" },
        metadata: {},
        emergencyContact: {},
        user: { id: "user-1", fullName: "Alice Worker", email: "alice@example.com", phone: "+251900000000", Roles: [{ key: "EMPLOYEE" }] },
        department: { id: "dept-1", key: "engineering", name: "Engineering" },
        position: { id: "pos-1", key: "engineer", title: "Engineer", departmentId: "dept-1" },
        manager: { id: "manager-1", email: "manager@example.com" },
      }],
    });

    const result = await new BulkEmployeeValidationService().validate(businessA, [
      baseRow({ profile: { monthlySalary: 1200 }, account: { password: "new-secret" } }),
    ]);

    expect(result.results[0].status).toBe("READY_TO_UPDATE");
    expect(result.results[0].changes).toEqual(expect.arrayContaining([
      { field: "profile.monthlySalary", currentValue: 1000, uploadedValue: 1200 },
    ]));
    expect(result.results[0].changes.some((change) => change.field.includes("password"))).toBe(false);
  });

  it("detects unchanged existing employees", async () => {
    makeDb({
      records: [{
        id: "rec-1",
        businessId: businessA,
        userId: "user-1",
        employeeCode: "EMP-100",
        departmentId: "dept-1",
        positionId: "pos-1",
        managerUserId: "manager-1",
        employmentType: "full_time",
        employmentStatus: "active",
        hireDate: "2024-01-01",
        contractStartDate: "2024-01-01",
        contractEndDate: "2025-01-01",
        salaryInfo: { baseSalary: 1000, currency: "ETB" },
        metadata: {},
        emergencyContact: {},
        user: { id: "user-1", fullName: "Alice Worker", email: "alice@example.com", phone: "+251900000000", Roles: [{ key: "EMPLOYEE" }] },
        department: { id: "dept-1", key: "engineering", name: "Engineering" },
        position: { id: "pos-1", key: "engineer", title: "Engineer", departmentId: "dept-1" },
        manager: { id: "manager-1", email: "manager@example.com" },
      }],
    });

    const result = await new BulkEmployeeValidationService().validate(businessA, [baseRow()]);
    expect(result.results[0].status).toBe("UNCHANGED");
    expect(result.results[0].changes).toHaveLength(0);
  });

  it("detects conflicts when employeeCode and email match different employees", async () => {
    makeDb({
      records: [{
        id: "rec-code",
        businessId: businessA,
        userId: "user-code",
        employeeCode: "EMP-100",
        user: { id: "user-code", email: "other@example.com", Roles: [{ key: "EMPLOYEE" }] },
      }],
      users: [{
        id: "user-email",
        businessId: businessA,
        fullName: "Alice Worker",
        email: "alice@example.com",
        Roles: [{ key: "EMPLOYEE" }],
        EmployeeRecords: [{ id: "rec-email", businessId: businessA, userId: "user-email", employeeCode: "EMP-200" }],
      }],
    });

    const result = await new BulkEmployeeValidationService().validate(businessA, [baseRow()]);
    expect(result.results[0].status).toBe("CONFLICT");
  });

  it("detects duplicate email and employeeCode inside payload", async () => {
    const result = await new BulkEmployeeValidationService().validate(businessA, [
      baseRow({ rowNumber: 1 }),
      baseRow({ rowNumber: 2, account: { email: "ALICE@example.com" }, profile: { employeeCode: "EMP-100" } }),
    ]);

    expect(result.summary.INVALID).toBe(2);
    expect(result.results[0].errors.map((e) => e.field)).toEqual(expect.arrayContaining(["employeeCode", "email"]));
  });

  it("detects invalid role, department, manager, and position references", async () => {
    makeDb({ roles: [], departments: [], positions: [], managers: [] });

    const result = await new BulkEmployeeValidationService().validate(businessA, [baseRow()]);
    expect(result.results[0].status).toBe("INVALID");
    expect(result.results[0].errors.map((e) => e.field)).toEqual(expect.arrayContaining([
      "profile.roleKeys",
      "departmentName",
      "profile.managerEmail",
      "positionName",
    ]));
  });

  it("isolates references and matches to the current business", async () => {
    makeDb({
      roles: [{ businessId: businessB, key: "EMPLOYEE" }],
      departments: [{ businessId: businessB, key: "engineering", name: "Engineering", id: "dept-b" }],
      positions: [{ businessId: businessB, id: "pos-1", title: "Engineer", departmentId: "dept-b" }],
      managers: [{ businessId: businessB, id: "manager-b", email: "manager@example.com" }],
      records: [{ businessId: businessB, id: "rec-b", userId: "user-b", employeeCode: "EMP-100" }],
    });

    const result = await new BulkEmployeeValidationService().validate(businessA, [baseRow()]);
    expect(result.results[0].status).toBe("INVALID");
  });

  it("does not create or update employee records", async () => {
    await new BulkEmployeeValidationService().validate(businessA, [baseRow()]);
    expect(db.EmployeeRecord.create).not.toHaveBeenCalled();
    expect(db.EmployeeRecord.update).not.toHaveBeenCalled();
  });

  it("creates employees with multiple roles and generated password", async () => {
    makeDb({ roles: [{ businessId: businessA, key: "EMPLOYEE" }, { businessId: businessA, key: "HR_MANAGER" }] });
    const setRoles = jest.fn();
    (db.User.create as jest.Mock).mockResolvedValue({ id: "new-user", setRoles });

    const result = await new BulkEmployeeValidationService().apply(businessA, [
      baseRow({ action: "CREATE", account: { password: null }, profile: { roleKeys: ["EMPLOYEE", "HR_MANAGER"] } }),
    ]);

    expect(result.created).toBe(1);
    expect(result.results[0].status).toBe("CREATED");
    expect(db.User.create).toHaveBeenCalledWith(expect.objectContaining({
      businessId: businessA,
      email: "alice@example.com",
      password: expect.any(String),
    }), expect.any(Object));
    expect(setRoles).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ key: "EMPLOYEE" }),
      expect.objectContaining({ key: "HR_MANAGER" }),
    ]), expect.any(Object));
    expect(db.EmployeeRecord.create).toHaveBeenCalledWith(expect.objectContaining({
      businessId: businessA,
      userId: "new-user",
      employeeCode: "EMP-100",
      metadata: expect.objectContaining({ branch: null }),
      salaryInfo: expect.objectContaining({ baseSalary: 1000, currency: "ETB" }),
    }), expect.any(Object));
  });

  it("updates approved rows, replaces roles, and does not update password", async () => {
    const userUpdate = jest.fn();
    const setRoles = jest.fn();
    const recordUpdate = jest.fn();
    const existing = {
      id: "rec-1",
      businessId: businessA,
      userId: "user-1",
      employeeCode: "EMP-100",
      departmentId: "dept-1",
      positionId: "pos-1",
      employmentType: "full_time",
      employmentStatus: "active",
      hireDate: "2024-01-01",
      salaryInfo: { baseSalary: 1000, currency: "ETB" },
      metadata: {},
      emergencyContact: {},
      user: { id: "user-1", businessId: businessA, fullName: "Alice Worker", email: "alice@example.com", phone: "+1", Roles: [{ key: "EMPLOYEE" }], update: userUpdate, setRoles },
      department: { id: "dept-1", key: "engineering", name: "Engineering" },
      position: { id: "pos-1", key: "engineer", title: "Engineer", departmentId: "dept-1" },
      update: recordUpdate,
    };
    makeDb({ records: [existing], roles: [{ businessId: businessA, key: "HR_MANAGER" }] });
    (db.EmployeeRecord.findOne as jest.Mock).mockResolvedValue(existing);

    const result = await new BulkEmployeeValidationService().apply(businessA, [
      baseRow({ action: "UPDATE", employeeId: "rec-1", account: { firstName: "Alicia", password: "must-not-change" }, profile: { roleKeys: ["HR_MANAGER"] } }),
    ]);

    expect(result.updated).toBe(1);
    expect(userUpdate).toHaveBeenCalledWith(expect.objectContaining({ fullName: "Alicia Worker", phone: "+251900000000" }), expect.any(Object));
    expect(JSON.stringify(userUpdate.mock.calls)).not.toContain("password");
    expect(setRoles).toHaveBeenCalledWith([expect.objectContaining({ key: "HR_MANAGER" })], expect.any(Object));
    expect(recordUpdate).toHaveBeenCalledWith(expect.objectContaining({ employeeCode: "EMP-100" }), expect.any(Object));
  });

  it("skips requested rows and leaves unchanged/conflict rows unwritten", async () => {
    const result = await new BulkEmployeeValidationService().apply(businessA, [
      baseRow({ action: "SKIP" }),
      baseRow({ rowNumber: 2, action: "CREATE", account: { email: "bad@example.com" }, profile: { employeeCode: "EMP-101", roleKeys: ["MISSING"] } }),
    ]);

    expect(result.skipped).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.results.map((r) => r.status)).toEqual(["SKIPPED", "FAILED"]);
  });

  it("protects against cross-business update by employeeId", async () => {
    makeDb({
      records: [{
        id: "rec-1",
        businessId: businessA,
        userId: "user-1",
        employeeCode: "EMP-100",
        employmentType: "full_time",
        employmentStatus: "active",
        hireDate: "2024-01-01",
        salaryInfo: { baseSalary: 1000, currency: "ETB" },
        metadata: {},
        emergencyContact: {},
        user: { id: "user-1", fullName: "Alice Worker", email: "alice@example.com", Roles: [{ key: "EMPLOYEE" }] },
      }],
    });
    (db.EmployeeRecord.findOne as jest.Mock).mockResolvedValue(null);

    const result = await new BulkEmployeeValidationService().apply(businessA, [
      baseRow({ action: "UPDATE", employeeId: "foreign-rec", profile: { monthlySalary: 1200 } }),
    ]);

    expect(result.failed).toBe(1);
    expect(result.results[0].status).toBe("FAILED");
  });

  it("rolls back failed rows while allowing partial success", async () => {
    const tx1 = { commit: jest.fn(), rollback: jest.fn() };
    const tx2 = { commit: jest.fn(), rollback: jest.fn() };
    (db.sequelize.transaction as jest.Mock).mockResolvedValueOnce(tx1).mockResolvedValueOnce(tx2);
    (db.EmployeeRecord.create as jest.Mock)
      .mockResolvedValueOnce({ id: "rec-ok", employeeCode: "EMP-100" })
      .mockRejectedValueOnce(new Error("insert failed"));

    const result = await new BulkEmployeeValidationService().apply(businessA, [
      baseRow({ action: "CREATE" }),
      baseRow({ rowNumber: 2, action: "CREATE", account: { email: "bob@example.com" }, profile: { employeeCode: "EMP-101" } }),
    ]);

    expect(result.created).toBe(1);
    expect(result.failed).toBe(1);
    expect(tx1.commit).toHaveBeenCalled();
    expect(tx2.rollback).toHaveBeenCalled();
  });
});
