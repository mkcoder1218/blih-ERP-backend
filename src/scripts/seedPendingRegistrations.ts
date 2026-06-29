import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { db } from "../models";

const COUNT = Number(process.env.PENDING_REGISTRATION_SEED_COUNT || 3);
const START = Number(process.env.PENDING_REGISTRATION_SEED_START || 901);
const BASE_EMAIL = process.env.PENDING_REGISTRATION_SEED_EMAIL_BASE || "pending.approval";
const EMAIL_DOMAIN = process.env.PENDING_REGISTRATION_SEED_EMAIL_DOMAIN || "example.com";
const SEED_BATCH = process.env.PENDING_REGISTRATION_SEED_BATCH || "pending-approval-finance-test";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function employeeCode(index: number) {
  return `PEND-${String(index).padStart(4, "0")}`;
}

function seedBankDetails(index: number) {
  return {
    bankName: "Commercial Bank of Ethiopia",
    accountNumber: `1000${String(index).padStart(8, "0")}`,
  };
}

async function getSeedBusiness() {
  const businessId = process.env.PENDING_REGISTRATION_SEED_BUSINESS_ID;
  if (businessId) {
    const business = await db.Business.findByPk(businessId);
    if (!business) throw new Error(`Business not found for PENDING_REGISTRATION_SEED_BUSINESS_ID=${businessId}`);
    return business;
  }

  const business = await db.Business.findOne({ order: [["createdAt", "ASC"]] });
  if (!business) throw new Error("No business found. Create a business before seeding pending registrations.");
  return business;
}

async function getDepartmentAndPosition(businessId: string) {
  const [department] = await db.Department.findOrCreate({
    where: { businessId, key: "seed-finance-approval" },
    defaults: {
      businessId,
      key: "seed-finance-approval",
      name: "Finance Approval Seed",
      description: "Seed department for pending registration approval testing.",
      status: "active",
    },
  });

  const [position] = await db.Position.findOrCreate({
    where: { businessId, key: "seed-finance-associate" },
    defaults: {
      businessId,
      departmentId: department.id,
      key: "seed-finance-associate",
      title: "Finance Approval Associate",
      level: 1,
      description: "Seed position for testing salary approval information.",
      status: "active",
    },
  });

  return { department, position };
}

async function run() {
  await db.sequelize.authenticate();

  const business = await getSeedBusiness();
  const businessId = business.id;
  const { department, position } = await getDepartmentAndPosition(businessId);
  const password = await bcrypt.hash(process.env.PENDING_REGISTRATION_SEED_PASSWORD || "Pending123!@#", 10);
  const created: string[] = [];
  const reused: string[] = [];

  for (let offset = 0; offset < COUNT; offset += 1) {
    const number = START + offset;
    const email = `${BASE_EMAIL}+${number}@${EMAIL_DOMAIN}`;
    const fullName = `Pending Finance Test ${number}`;
    const phone = `+2519${String(number).padStart(8, "0").slice(-8)}`;
    const bank = seedBankDetails(number);

    const [user, userCreated] = await db.User.findOrCreate({
      where: { businessId, email },
      defaults: {
        businessId,
        fullName,
        email,
        password,
        phone,
        status: "pending",
        registrationToken: randomUUID(),
      },
    });

    if (!userCreated) {
      await user.update({
        fullName,
        phone,
        status: "pending",
        rejectionReason: null,
        rejectedAt: null,
        approvedAt: null,
        approvedByUserId: null,
        registrationToken: user.registrationToken || randomUUID(),
      });
      reused.push(email);
    } else {
      created.push(email);
    }

    await db.BusinessUserProfile.upsert({
      businessId,
      userId: user.id,
      departmentId: department.id,
      positionId: position.id,
      employeeCode: employeeCode(number),
      workEmail: email,
      workPhone: phone,
      employmentType: "full_time",
      joinedAt: addDays(new Date(), 7 + offset),
      status: "pending",
      settings: {
        requestedRoleKey: "EMPLOYEE",
        dateOfBirth: "1998-01-15",
        gender: offset % 2 === 0 ? "Male" : "Female",
        maritalStatus: "single",
        nationality: "Ethiopia",
        address: "Addis Ababa",
        city: "Addis Ababa",
        country: "Ethiopia",
        seedBatch: SEED_BATCH,
      },
    });

    const [record] = await db.EmployeeRecord.findOrCreate({
      where: { userId: user.id },
      defaults: {
        businessId,
        userId: user.id,
        employeeCode: employeeCode(number),
        departmentId: department.id,
        positionId: position.id,
        employmentType: "full_time",
        employmentStatus: "pending",
        hireDate: addDays(new Date(), 7 + offset),
        salaryInfo: {},
        emergencyContact: {
          firstName: "Seed",
          lastName: "Contact",
          phone: "+251911000000",
          relationship: "Emergency contact",
        },
        metadata: {
          seedBatch: SEED_BATCH,
          idDocumentFrontUrl: "/uploads/seed-fayda-front.png",
          idDocumentBackUrl: "/uploads/seed-fayda-back.png",
          bankDetails: [bank],
          bankAccountNumber: bank.accountNumber,
        },
      },
    });

    await record.update({
      businessId,
      employeeCode: employeeCode(number),
      departmentId: department.id,
      positionId: position.id,
      employmentType: "full_time",
      employmentStatus: "pending",
      hireDate: addDays(new Date(), 7 + offset),
      salaryInfo: {},
      metadata: {
        ...(record.metadata || {}),
        seedBatch: SEED_BATCH,
        bankDetails: record.metadata?.bankDetails?.length ? record.metadata.bankDetails : [bank],
        bankAccountNumber: record.metadata?.bankAccountNumber || bank.accountNumber,
      },
    });
  }

  console.log(`Business: ${business.name || business.id} (${businessId})`);
  console.log(`Created ${created.length} pending registrations. Reused ${reused.length}.`);
  [...created, ...reused].forEach((email) => console.log(email));
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.sequelize.close();
  });
