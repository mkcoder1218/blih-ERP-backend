import bcrypt from "bcrypt";
import { db } from "../models";
import { env } from "../config/env";

const BUSINESS_ID =
  process.env.JOB_REQUEST_MANAGER_SEED_BUSINESS_ID ||
  "99fc7d4b-b085-4229-a563-8086fdfee17d";

const DEFAULT_PASSWORD = process.env.JOB_REQUEST_MANAGER_SEED_PASSWORD || "JobRequest123!";

const seedAccounts = [
  {
    email: process.env.JOB_REQUEST_DEPARTMENT_HEAD_EMAIL || "department.head@blih.local",
    fullName: "Seed Department Head",
    phone: "+251900000101",
    roleKey: "DEPARTMENT_HEAD",
    roleName: "Department Head",
    roleDomain: null,
    departmentKey: "seed-operations",
    departmentName: "Seed Operations",
    positionKey: "seed-department-head",
    positionTitle: "Department Head",
    employeeCode: "SEED-DH-001",
  },
  {
    email: process.env.JOB_REQUEST_HR_MANAGER_EMAIL || "hr.manager@blih.local",
    fullName: "Seed HR Manager",
    phone: "+251900000102",
    roleKey: "HR_MANAGER",
    roleName: "HR Manager",
    roleDomain: "hr",
    departmentKey: "seed-human-resources",
    departmentName: "Seed Human Resources",
    positionKey: "seed-hr-manager",
    positionTitle: "HR Manager",
    employeeCode: "SEED-HR-001",
  },
] as const;

async function findOrCreateRole(account: (typeof seedAccounts)[number], transaction: any) {
  const [role] = await db.Role.findOrCreate({
    where: { businessId: null, key: account.roleKey },
    defaults: {
      businessId: null,
      key: account.roleKey,
      name: account.roleName,
      domain: account.roleDomain,
      isSystemRole: true,
    },
    transaction,
  });

  const roleUpdates: Record<string, unknown> = {};
  if (role.name !== account.roleName) roleUpdates.name = account.roleName;
  if ((role.domain || null) !== account.roleDomain) roleUpdates.domain = account.roleDomain;
  if (!role.isSystemRole) roleUpdates.isSystemRole = true;
  if (Object.keys(roleUpdates).length) await role.update(roleUpdates, { transaction });

  return role;
}

async function findOrCreateDepartmentAndPosition(account: (typeof seedAccounts)[number], transaction: any) {
  const [department] = await db.Department.findOrCreate({
    where: { businessId: BUSINESS_ID, key: account.departmentKey },
    defaults: {
      businessId: BUSINESS_ID,
      key: account.departmentKey,
      name: account.departmentName,
      description: "Seeded department for job request approval testing.",
      status: "active",
    },
    transaction,
  });

  await department.update(
    {
      name: account.departmentName,
      status: "active",
      description: department.description || "Seeded department for job request approval testing.",
    },
    { transaction },
  );

  const [position] = await db.Position.findOrCreate({
    where: { businessId: BUSINESS_ID, key: account.positionKey },
    defaults: {
      businessId: BUSINESS_ID,
      departmentId: department.id,
      key: account.positionKey,
      title: account.positionTitle,
      level: account.roleKey === "HR_MANAGER" ? 3 : 4,
      description: "Seeded position for job request approval testing.",
      status: "active",
    },
    transaction,
  });

  await position.update(
    {
      departmentId: department.id,
      title: account.positionTitle,
      status: "active",
      description: position.description || "Seeded position for job request approval testing.",
    },
    { transaction },
  );

  return { department, position };
}

async function upsertProfileAndEmployeeRecord(
  account: (typeof seedAccounts)[number],
  user: any,
  department: any,
  position: any,
  transaction: any,
) {
  await db.BusinessUserProfile.upsert(
    {
      businessId: BUSINESS_ID,
      userId: user.id,
      departmentId: department.id,
      positionId: position.id,
      employeeCode: account.employeeCode,
      workEmail: account.email,
      workPhone: account.phone,
      employmentType: "full_time",
      joinedAt: new Date(),
      status: "active",
      settings: {
        seedBatch: "job-request-manager-accounts",
        roleKey: account.roleKey,
      },
    },
    { transaction },
  );

  const [record] = await db.EmployeeRecord.findOrCreate({
    where: { userId: user.id },
    defaults: {
      businessId: BUSINESS_ID,
      userId: user.id,
      employeeCode: account.employeeCode,
      departmentId: department.id,
      positionId: position.id,
      employmentType: "full_time",
      employmentStatus: "active",
      hireDate: new Date(),
      salaryInfo: {},
      emergencyContact: {},
      metadata: {
        seedBatch: "job-request-manager-accounts",
        roleKey: account.roleKey,
      },
    },
    transaction,
  });

  await record.update(
    {
      businessId: BUSINESS_ID,
      employeeCode: account.employeeCode,
      departmentId: department.id,
      positionId: position.id,
      employmentType: "full_time",
      employmentStatus: "active",
      hireDate: record.hireDate || new Date(),
      metadata: {
        ...(record.metadata || {}),
        seedBatch: "job-request-manager-accounts",
        roleKey: account.roleKey,
      },
    },
    { transaction },
  );
}

async function run() {
  await db.sequelize.authenticate();

  const business = await db.Business.findByPk(BUSINESS_ID);
  if (!business) {
    throw new Error(`Business not found for JOB_REQUEST_MANAGER_SEED_BUSINESS_ID=${BUSINESS_ID}`);
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, env.bcryptSaltRounds);
  const results: Array<{ email: string; password: string; role: string; userId: string; created: boolean }> = [];

  await db.sequelize.transaction(async (transaction: any) => {
    for (const account of seedAccounts) {
      const role = await findOrCreateRole(account, transaction);
      const { department, position } = await findOrCreateDepartmentAndPosition(account, transaction);

      const [user, created] = await db.User.findOrCreate({
        where: { businessId: BUSINESS_ID, email: account.email },
        defaults: {
          businessId: BUSINESS_ID,
          fullName: account.fullName,
          email: account.email,
          password: passwordHash,
          phone: account.phone,
          status: "active",
          approvedAt: new Date(),
        },
        transaction,
      });

      await user.update(
        {
          fullName: account.fullName,
          phone: account.phone,
          password: passwordHash,
          status: "active",
          rejectionReason: null,
          rejectedAt: null,
          registrationToken: null,
          approvedAt: user.approvedAt || new Date(),
        },
        { transaction },
      );

      await db.UserRole.findOrCreate({
        where: { userId: user.id, roleId: role.id },
        defaults: { userId: user.id, roleId: role.id },
        transaction,
      });

      await upsertProfileAndEmployeeRecord(account, user, department, position, transaction);

      results.push({
        email: account.email,
        password: DEFAULT_PASSWORD,
        role: account.roleKey,
        userId: user.id,
        created,
      });
    }
  });

  console.log(`Business: ${business.name || business.id} (${BUSINESS_ID})`);
  console.log("Seeded job request manager accounts:");
  for (const result of results) {
    console.log(
      `${result.created ? "created" : "updated"} | ${result.role} | ${result.email} | password=${result.password} | userId=${result.userId}`,
    );
  }
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.sequelize.close();
  });
