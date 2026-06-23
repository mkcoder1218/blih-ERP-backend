import { randomUUID } from "crypto";
import { db } from "../models";

const COUNT = Number(process.env.ONBOARDING_SEED_COUNT || 5);
const START = Number(process.env.ONBOARDING_SEED_START || 111);
const BASE_EMAIL = process.env.ONBOARDING_SEED_EMAIL_BASE || "codemk1218";
const EMAIL_DOMAIN = process.env.ONBOARDING_SEED_EMAIL_DOMAIN || "gmail.com";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const onboardingUrlFor = (businessSlug: string, onboardingId: string) =>
  `${FRONTEND_URL.replace(/\/$/, "")}/register/${encodeURIComponent(businessSlug)}?onboarding=${encodeURIComponent(onboardingId)}`;
const SEED_BATCH = process.env.ONBOARDING_SEED_BATCH || "onboarding-flow-test";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

async function getSeedBusiness() {
  const businessId = process.env.ONBOARDING_SEED_BUSINESS_ID;
  if (businessId) {
    const business = await db.Business.findByPk(businessId);
    if (!business) throw new Error(`Business not found for ONBOARDING_SEED_BUSINESS_ID=${businessId}`);
    return business;
  }

  const business = await db.Business.findOne({ order: [["createdAt", "ASC"]] });
  if (!business) throw new Error("No business found. Create a business before seeding onboarding candidates.");
  return business;
}

async function getSeedCreator(businessId: string) {
  const creatorId = process.env.ONBOARDING_SEED_CREATED_BY_ID;
  if (creatorId) {
    const user = await db.User.findOne({ where: { id: creatorId, businessId } });
    if (!user) throw new Error(`User not found for ONBOARDING_SEED_CREATED_BY_ID=${creatorId}`);
    return user;
  }

  const user = await db.User.findOne({ where: { businessId }, order: [["createdAt", "ASC"]] });
  if (!user) throw new Error("No user found for selected business. Create an admin/HR user first.");
  return user;
}

async function getSeedTemplate(businessId: string, createdById: string) {
  const existing = await db.OfferLetterTemplate.findOne({ where: { businessId, isActive: true }, order: [["createdAt", "ASC"]] });
  if (existing) return existing;

  return db.OfferLetterTemplate.create({
    businessId,
    name: "Seed Offer Letter Template",
    subject: "Offer Letter for {{candidateName}}",
    bodyHtml: "<p>Dear {{candidateName}},</p><p>This is a seed offer letter for onboarding testing.</p>",
    bodyText: "Dear {{candidateName}}, this is a seed offer letter for onboarding testing.",
    variables: ["candidateName"],
    createdById,
    updatedById: createdById,
    isActive: true,
  });
}

async function run() {
  await db.sequelize.authenticate();

  const business = await getSeedBusiness();
  const businessId = business.id;
  const creator = await getSeedCreator(businessId);
  const template = await getSeedTemplate(businessId, creator.id);
  const department = await db.Department.findOne({ where: { businessId }, order: [["createdAt", "ASC"]] });
  const position = await db.Position.findOne({ where: { businessId }, order: [["createdAt", "ASC"]] });

  const created: Array<{ email: string; onboardingUrl: string; offerId: string }> = [];
  const reused: Array<{ email: string; onboardingUrl: string; offerId: string }> = [];

  for (let index = 0; index < COUNT; index += 1) {
    const number = START + index;
    const email = `${BASE_EMAIL}+${number}@${EMAIL_DOMAIN}`;
    const candidateName = `Onboarding Test ${number}`;

    const [offer] = await db.OfferLetter.findOrCreate({
      where: { businessId, candidateEmail: email },
      defaults: {
        businessId,
        templateId: template.id,
        candidateName,
        candidateEmail: email,
        candidatePhone: `+251900${String(number).padStart(6, "0")}`,
        departmentId: department?.id || null,
        positionId: position?.id || null,
        salary: "25000",
        startDate: addDays(new Date(), 14 + index),
        employmentType: "full_time",
        workLocation: "Addis Ababa",
        reportingManager: creator.fullName,
        reportingManagerId: creator.id,
        status: "ACCEPTED",
        renderedSubject: `Offer Letter for ${candidateName}`,
        renderedHtml: `<p>Dear ${candidateName}, welcome.</p>`,
        renderedText: `Dear ${candidateName}, welcome.`,
        sentAt: new Date(),
        acceptedAt: new Date(),
        onboardingInitialized: true,
        createdById: creator.id,
        metadata: { seedBatch: SEED_BATCH },
      },
    });

    if (offer.status !== "ACCEPTED" || !offer.onboardingInitialized) {
      await offer.update({ status: "ACCEPTED", acceptedAt: offer.acceptedAt || new Date(), onboardingInitialized: true });
    }

    const existingOnboarding = await db.CandidateOnboarding.findOne({ where: { businessId, offerId: offer.id } });
    if (existingOnboarding) {
      reused.push({
        email,
        offerId: offer.id,
        onboardingUrl: onboardingUrlFor(business.slug, existingOnboarding.onboardingId),
      });
      continue;
    }

    const onboardingId = randomUUID();
    const assignedEmail = `employee${number}@${String(business.slug || "company").replace(/[^a-z0-9-]/gi, "").toLowerCase() || "company"}.test`;
    const onboarding = await db.CandidateOnboarding.create({
      onboardingId,
      businessId,
      offerId: offer.id,
      candidateEmail: email,
      candidateName,
      status: "PENDING_CANDIDATE_COMPLETION",
      sections: ["overview", "personal_info", "documents", "emergency_contact", "payroll", "policies", "resources", "review"],
      resources: [
        {
          resourceName: `Seed Laptop ${number}`,
          resourceType: "Laptop",
          quantity: 1,
          condition: "Good",
          assetTag: `SEED-LAP-${number}`,
          returnRequired: true,
          acceptanceRequired: true,
        },
      ],
      requiredDocuments: [
        { name: "National ID / Passport", required: true },
        { name: "Proof of Address", required: true },
      ],
      requiredPolicies: [
        {
          policyId: "seed-terms-and-conditions",
          policyType: "terms-and-conditions",
          title: "Terms and Conditions",
          version: 1,
          required: true,
          content: "Seed employee policy for onboarding testing. Candidate must accept before submission.",
        },
      ],
      candidateData: { personal_info: { email: assignedEmail } },
      resourceResponses: [],
      progress: 0,
      initializedById: creator.id,
      metadata: {
        seedBatch: SEED_BATCH,
        assignedEmail,
        salary: offer.salary,
        startDate: offer.startDate,
        employmentType: offer.employmentType,
        workLocation: offer.workLocation,
        reportingManager: offer.reportingManager,
        expiresAt: addDays(new Date(), 10),
      },
    });

    created.push({
      email,
      offerId: offer.id,
      onboardingUrl: onboardingUrlFor(business.slug, onboarding.onboardingId),
    });
  }

  console.log(`Business: ${business.name || business.id} (${businessId})`);
  console.log(`Created ${created.length} onboarding candidates. Reused ${reused.length}.`);
  [...created, ...reused].forEach((row) => {
    console.log(`${row.email} | offer=${row.offerId} | ${row.onboardingUrl}`);
  });
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.sequelize.close();
  });
