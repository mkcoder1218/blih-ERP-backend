import { Op } from "sequelize";
import { db } from "../models";

const APPLICANTS_PER_POST = Number(process.env.ACTIVE_POSTING_APPLICANTS_PER_POST || 6);
const PENDING_OFFERS_PER_POST = Number(process.env.ACTIVE_POSTING_PENDING_OFFERS_PER_POST || 3);
const BUSINESS_ID = process.env.ACTIVE_POSTING_BUSINESS_ID;
const JOB_OPENING_ID = process.env.ACTIVE_POSTING_JOB_OPENING_ID;
const EMAIL_DOMAIN = process.env.ACTIVE_POSTING_APPLICANT_EMAIL_DOMAIN || "example.com";
const SEED_BATCH = process.env.ACTIVE_POSTING_APPLICANT_BATCH || "active-posting-applicants";

const FIRST_NAMES = [
  "Amina",
  "Noah",
  "Maya",
  "Elias",
  "Sara",
  "Daniel",
  "Lina",
  "Samuel",
  "Ruth",
  "Jonas",
  "Hanna",
  "Micah",
];

const LAST_NAMES = [
  "Bekele",
  "Tesfaye",
  "Abebe",
  "Kebede",
  "Hassan",
  "Mekonnen",
  "Ayele",
  "Dawit",
  "Tadesse",
  "Yohannes",
  "Demissie",
  "Gebre",
];

const STAGES = ["applied", "screened", "shortlisted"];
const SOURCES = ["careers_page", "linkedin", "referral", "job_board", "walk_in"];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
}

function scoreFor(index: number) {
  return Math.min(98, 62 + ((index * 7) % 34));
}

async function getSeedBusinessId() {
  if (BUSINESS_ID) {
    const business = await db.Business.findByPk(BUSINESS_ID);
    if (!business) throw new Error(`Business not found for ACTIVE_POSTING_BUSINESS_ID=${BUSINESS_ID}`);
    return business.id;
  }

  if (JOB_OPENING_ID) {
    const opening = await db.JobOpening.findByPk(JOB_OPENING_ID);
    if (!opening) throw new Error(`Job opening not found for ACTIVE_POSTING_JOB_OPENING_ID=${JOB_OPENING_ID}`);
    return opening.businessId;
  }

  const activeOpening = await db.JobOpening.findOne({
    where: { status: { [Op.in]: ["open", "active", "published"] } },
    order: [["createdAt", "DESC"]],
  });
  if (activeOpening) return activeOpening.businessId;

  const business = await db.Business.findOne({ order: [["createdAt", "ASC"]] });
  if (!business) throw new Error("No business found. Create a business before seeding active posting applicants.");
  return business.id;
}

async function getActiveOpenings(businessId: string) {
  const where: any = {
    businessId,
    status: { [Op.in]: ["open", "active", "published"] },
  };

  if (JOB_OPENING_ID) {
    where.id = JOB_OPENING_ID;
  }

  const openings = await db.JobOpening.findAll({
    where,
    order: [["createdAt", "DESC"]],
  });

  if (JOB_OPENING_ID && openings.length === 0) {
    throw new Error(`Job opening ${JOB_OPENING_ID} is not active/open for business ${businessId}.`);
  }

  return openings;
}

async function getSeedCreator(businessId: string) {
  const user = await db.User.findOne({ where: { businessId }, order: [["createdAt", "ASC"]] });
  if (!user) throw new Error(`No user found for business ${businessId}. Create an admin/HR user before seeding offers.`);
  return user;
}

async function getSeedTemplate(businessId: string, createdById: string) {
  const existing = await db.OfferLetterTemplate.findOne({
    where: { businessId, isActive: true },
    order: [["createdAt", "ASC"]],
  });
  if (existing) return existing;

  return db.OfferLetterTemplate.create({
    businessId,
    name: "Seed Offer Letter Template",
    subject: "Offer Letter for {{candidateName}}",
    bodyHtml: [
      "<p>Dear {{candidateName}},</p>",
      "<p>We are pleased to offer you the {{positionTitle}} role at {{company}}.</p>",
      "<p>Salary: {{salary}}</p>",
      "<p>Start date: {{startDate}}</p>",
      "<p>Work location: {{workLocation}}</p>",
    ].join(""),
    bodyText: "Dear {{candidateName}}, we are pleased to offer you the {{positionTitle}} role at {{company}}. Salary: {{salary}}. Start date: {{startDate}}. Work location: {{workLocation}}.",
    variables: ["candidateName", "positionTitle", "company", "salary", "startDate", "workLocation"],
    createdById,
    updatedById: createdById,
    isActive: true,
  });
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

async function seedPendingOffersForOpening(opening: any, template: any, creator: any) {
  if (PENDING_OFFERS_PER_POST < 1) return { created: [], reused: [] };

  const applications = await db.JobApplication.findAll({
    where: {
      businessId: opening.businessId,
      jobOpeningId: opening.id,
    },
    order: [
      ["score", "DESC"],
      ["createdAt", "ASC"],
    ],
    limit: PENDING_OFFERS_PER_POST,
  });

  const department = opening.departmentId
    ? await db.Department.findByPk(opening.departmentId)
    : await db.Department.findOne({ where: { businessId: opening.businessId }, order: [["createdAt", "ASC"]] });
  const position = opening.positionId
    ? await db.Position.findByPk(opening.positionId)
    : await db.Position.findOne({ where: { businessId: opening.businessId }, order: [["createdAt", "ASC"]] });
  const business = await db.Business.findByPk(opening.businessId);

  const created: string[] = [];
  const reused: string[] = [];

  for (const [index, application] of applications.entries()) {
    const existing = await db.OfferLetter.findOne({
      where: {
        businessId: opening.businessId,
        candidateEmail: application.email,
      },
      order: [["createdAt", "DESC"]],
    });

    if (existing) {
      reused.push(application.email);
      continue;
    }

    const salary = String(25000 + index * 3500);
    const startDate = addDays(new Date(), 14 + index * 3);
    const positionTitle = position?.title || opening.title;
    const company = business?.name || "Blih";
    const renderedSubject = `Offer Letter for ${application.fullName}`;
    const renderedHtml = [
      `<p>Dear ${application.fullName},</p>`,
      `<p>We are pleased to offer you the ${positionTitle} role at ${company}.</p>`,
      `<p>Salary: ${salary}</p>`,
      `<p>Start date: ${startDate}</p>`,
      "<p>This draft is ready for HR to review and send.</p>",
    ].join("");
    const renderedText = `Dear ${application.fullName}, we are pleased to offer you the ${positionTitle} role at ${company}. Salary: ${salary}. Start date: ${startDate}. This draft is ready for HR to review and send.`;

    await db.OfferLetter.create({
      businessId: opening.businessId,
      templateId: template.id,
      candidateName: application.fullName,
      candidateEmail: application.email,
      candidatePhone: application.phone || null,
      departmentId: department?.id || opening.departmentId || null,
      positionId: position?.id || opening.positionId || null,
      salary,
      startDate,
      employmentType: opening.employmentType || "Full-time",
      workLocation: application.metadata?.location || "Addis Ababa",
      reportingManager: creator.fullName || creator.email || "HR Manager",
      status: "DRAFT",
      renderedSubject,
      renderedHtml,
      renderedText,
      createdById: creator.id,
    });

    await application.update({ stage: "offered" });
    created.push(application.email);
  }

  return { created, reused };
}

async function seedApplicantsForOpening(opening: any) {
  const existingCount = await db.JobApplication.count({
    where: {
      businessId: opening.businessId,
      jobOpeningId: opening.id,
    },
  });

  const needed = Math.max(0, APPLICANTS_PER_POST - existingCount);
  const created: string[] = [];
  const reused: string[] = [];
  const jobSlug = slugify(opening.title || "job");
  const openingKey = String(opening.id).split("-")[0];

  for (let index = 0; index < APPLICANTS_PER_POST * 2 && created.length < needed; index += 1) {
    const firstName = FIRST_NAMES[index % FIRST_NAMES.length];
    const lastName = LAST_NAMES[(index + 3) % LAST_NAMES.length];
    const fullName = `${firstName} ${lastName}`;
    const email = `${jobSlug}.${openingKey}.applicant${index + 1}@${EMAIL_DOMAIN}`;

    const [application, wasCreated] = await db.JobApplication.findOrCreate({
      where: {
        businessId: opening.businessId,
        jobOpeningId: opening.id,
        email,
      },
      defaults: {
        businessId: opening.businessId,
        jobOpeningId: opening.id,
        fullName,
        email,
        phone: `+2519${String(10000000 + index * 137).slice(0, 8)}`,
        source: SOURCES[index % SOURCES.length],
        stage: STAGES[index % STAGES.length],
        score: scoreFor(index),
        metadata: {
          seedBatch: SEED_BATCH,
          firstName,
          lastName,
          currentTitle: ["Frontend Developer", "HR Officer", "Accountant", "Operations Coordinator"][index % 4],
          yearsOfExperience: 2 + (index % 7),
          education: ["BSc Computer Science", "BA Management", "BBA Accounting", "Diploma IT"][index % 4],
          expectedSalary: 18000 + index * 2500,
          noticePeriod: ["Immediate", "15 days", "30 days"][index % 3],
          location: ["Addis Ababa", "Dire Dawa", "Bahir Dar", "Remote"][index % 4],
          resumeUrl: `https://example.com/resumes/${jobSlug}-${index + 1}.pdf`,
          coverLetter: `I am interested in the ${opening.title} role and available for interviews this week.`,
        },
      },
    });

    if (wasCreated) created.push(application.email);
    else reused.push(application.email);
  }

  return { opening, created, reused, existingCount };
}

async function run() {
  if (!Number.isFinite(APPLICANTS_PER_POST) || APPLICANTS_PER_POST < 1) {
    throw new Error("ACTIVE_POSTING_APPLICANTS_PER_POST must be a positive number.");
  }
  if (!Number.isFinite(PENDING_OFFERS_PER_POST) || PENDING_OFFERS_PER_POST < 0) {
    throw new Error("ACTIVE_POSTING_PENDING_OFFERS_PER_POST must be zero or a positive number.");
  }

  await db.sequelize.authenticate();

  const businessId = await getSeedBusinessId();
  const openings = await getActiveOpenings(businessId);
  if (openings.length === 0) {
    console.log(`No active job postings found for business ${businessId}. Publish a job first, then run this script again.`);
    return;
  }

  console.log(`Business: ${businessId}`);
  console.log(`Target applicants per active posting: ${APPLICANTS_PER_POST}`);
  console.log(`Target pending offers per active posting: ${PENDING_OFFERS_PER_POST}`);

  const creator = await getSeedCreator(businessId);
  const template = await getSeedTemplate(businessId, creator.id);

  for (const opening of openings) {
    const result = await seedApplicantsForOpening(opening);
    const offers = await seedPendingOffersForOpening(opening, template, creator);
    console.log("");
    console.log(`${result.opening.title} (${result.opening.id})`);
    console.log(`Existing before seed: ${result.existingCount}`);
    console.log(`Created ${result.created.length}. Reused ${result.reused.length}.`);
    [...result.created, ...result.reused].forEach((email) => console.log(`- ${email}`));
    console.log(`Pending offers created ${offers.created.length}. Reused ${offers.reused.length}.`);
    [...offers.created, ...offers.reused].forEach((email) => console.log(`  offer: ${email}`));
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
