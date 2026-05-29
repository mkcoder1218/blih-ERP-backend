import { env } from "../config/env";
import { sequelize, authenticateDB } from "./sequelize";
import { seedDefaults } from "./seed";
import "../models"; // ensure models loaded + associations registered on shared sequelize instance

async function tableExists(tableName: string): Promise<boolean> {
  try {
    await sequelize.getQueryInterface().describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

async function ensureSectorFocusSchema() {
  const qi = sequelize.getQueryInterface();
  const { DataTypes } = require("sequelize");

  const hasSectorTable = await tableExists("sector_focuses");
  if (!hasSectorTable) {
    await qi.createTable("sector_focuses", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      name: { type: DataTypes.STRING(120), allowNull: false },
      key: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      description: { type: DataTypes.STRING(255), allowNull: true },
      status: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "active" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deletedAt: { type: DataTypes.DATE, allowNull: true }
    } as any);
  }

  const businessDesc = await qi.describeTable("businesses").catch(() => null as any);
  if (businessDesc && !businessDesc.sectorFocusId) {
    await qi.addColumn("businesses", "sectorFocusId", { type: DataTypes.UUID, allowNull: true } as any);
    await qi.addConstraint("businesses", {
      fields: ["sectorFocusId"],
      type: "foreign key",
      name: "businesses_sectorFocusId_fkey",
      references: { table: "sector_focuses", field: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE"
    } as any);
  }
}

async function ensurePeopleProfileSchema() {
  const qi = sequelize.getQueryInterface();
  const { DataTypes } = require("sequelize");

  const hasTemplates = await tableExists("profile_templates");
  if (!hasTemplates) {
    await qi.createTable("profile_templates", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      businessId: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING(160), allowNull: false },
      description: { type: DataTypes.STRING(500), allowNull: true },
      fields: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deletedAt: { type: DataTypes.DATE, allowNull: true }
    } as any);
    await qi.addIndex("profile_templates", ["businessId"], { name: "profile_templates_businessId_idx" } as any);
    await qi.addConstraint("profile_templates", {
      fields: ["businessId"],
      type: "foreign key",
      name: "profile_templates_businessId_fkey",
      references: { table: "businesses", field: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE"
    } as any);
  }

  const hasDrafts = await tableExists("profile_drafts");
  if (!hasDrafts) {
    await qi.createTable("profile_drafts", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      businessId: { type: DataTypes.UUID, allowNull: false },
      templateId: { type: DataTypes.UUID, allowNull: false },
      status: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "draft" },
      data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdById: { type: DataTypes.UUID, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deletedAt: { type: DataTypes.DATE, allowNull: true }
    } as any);
    await qi.addIndex("profile_drafts", ["businessId"], { name: "profile_drafts_businessId_idx" } as any);
    await qi.addIndex("profile_drafts", ["templateId"], { name: "profile_drafts_templateId_idx" } as any);
    await qi.addIndex("profile_drafts", ["createdById"], { name: "profile_drafts_createdById_idx" } as any);
    await qi.addConstraint("profile_drafts", {
      fields: ["businessId"],
      type: "foreign key",
      name: "profile_drafts_businessId_fkey",
      references: { table: "businesses", field: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE"
    } as any);
    await qi.addConstraint("profile_drafts", {
      fields: ["templateId"],
      type: "foreign key",
      name: "profile_drafts_templateId_fkey",
      references: { table: "profile_templates", field: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE"
    } as any);
    await qi.addConstraint("profile_drafts", {
      fields: ["createdById"],
      type: "foreign key",
      name: "profile_drafts_createdById_fkey",
      references: { table: "users", field: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE"
    } as any);
  }
}

export async function initDatabase() {
  try {
    await authenticateDB();
    // eslint-disable-next-line no-console
    console.log("DB connected");

    if (env.nodeEnv === "production" && env.dbSync) {
      throw new Error("Critical Vulnerability: DB_SYNC strictly prohibited in production context. Migrations exclusively supported.");
    }

    if (env.nodeEnv === "development" && env.dbSync) {
      // NOTE: sequelize.sync({ alter: true }) can crash on some Postgres setups when
      // existing index DDL can't be parsed by Sequelize. Keep dev sync non-altering.
      await sequelize.sync();
      // eslint-disable-next-line no-console
      console.log("DB synced");
    }

    if (env.nodeEnv === "development") {
      await ensureSectorFocusSchema();
      await ensurePeopleProfileSchema();
      await ensureRecruitmentSchema();
      await ensureFileAssetPublicUploadSchema();
      await ensureInterviewSkillsSchema();
      await ensureInterviewerNotesSchema();
      await ensureRolesDomainSchema();
      await ensureOfferLettersSchema();
      await ensureCandidateOnboardingSchema();
    }

    const canSeed = await tableExists("permissions");
    if (canSeed) {
      await seedDefaults();
      // eslint-disable-next-line no-console
      console.log("DB seeded");
    } else {
      // eslint-disable-next-line no-console
      console.log("Tables missing. Set DB_SYNC=true in development or run migrations.");
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("DB init failed", err);
    throw err;
  }
}

async function ensureRecruitmentSchema() {
  const qi = sequelize.getQueryInterface();
  const { DataTypes } = require("sequelize");

  const hasTemplates = await tableExists("hr_recruitment_templates");
  if (!hasTemplates) {
    await qi.createTable("hr_recruitment_templates", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      businessId: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      requestConfig: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      jobDetailsConfig: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      applicationFormConfig: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdByUserId: { type: DataTypes.UUID, allowNull: false },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deletedAt: { type: DataTypes.DATE, allowNull: true }
    } as any);
    await qi.addIndex("hr_recruitment_templates", ["businessId"], { name: "hr_recruitment_templates_businessId_idx" } as any);
    await qi.addConstraint("hr_recruitment_templates", {
      fields: ["businessId"],
      type: "foreign key",
      name: "hr_recruitment_templates_businessId_fkey",
      references: { table: "businesses", field: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE"
    } as any);
  }
}

/**
 * Public resume uploads (careers page) have no authenticated user.
 * The DB column was created with NOT NULL + FK on uploadedByUserId, which
 * conflicts with the Sequelize model definition (allowNull: true).
 * This migration drops the FK constraint and makes the column nullable so
 * public uploads can store NULL and be traced back via the JobApplication.cvFileId.
 */
async function ensureFileAssetPublicUploadSchema() {
  try {
    const qi = sequelize.getQueryInterface();
    const { DataTypes } = require("sequelize");

    // Check if the table exists at all
    const hasTable = await tableExists("file_assets");
    if (!hasTable) return;

    // Describe the column to check its current nullability
    const desc: any = await qi.describeTable("file_assets");
    const col = desc["uploadedByUserId"];

    // If the column already allows null, nothing to do
    if (col && col.allowNull === true) return;

    // Drop the FK constraint if it exists (Sequelize names it automatically)
    try {
      await sequelize.query(
        `ALTER TABLE "file_assets" DROP CONSTRAINT IF EXISTS "file_assets_uploadedByUserId_fkey";`
      );
    } catch {
      // constraint may not exist under that name — safe to ignore
    }

    // Alter the column to allow NULL
    await qi.changeColumn("file_assets", "uploadedByUserId", {
      type: DataTypes.UUID,
      allowNull: true,
    } as any);

    // Re-add the FK with ON DELETE SET NULL so referential integrity is preserved
    // but public rows (NULL) are allowed
    try {
      await qi.addConstraint("file_assets", {
        fields: ["uploadedByUserId"],
        type: "foreign key",
        name: "file_assets_uploadedByUserId_fkey",
        references: { table: "users", field: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      } as any);
    } catch {
      // FK may already exist after a partial run — safe to ignore
    }

    console.log("file_assets.uploadedByUserId patched to allow NULL for public uploads.");
  } catch (err) {
    console.error("ensureFileAssetPublicUploadSchema failed:", err);
  }
}

async function ensureInterviewSkillsSchema() {
  const qi = sequelize.getQueryInterface();
  const { DataTypes } = require("sequelize");

  // Create skills table
  const hasSkills = await tableExists("skills");
  if (!hasSkills) {
    await qi.createTable("skills", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      businessId: { type: DataTypes.UUID, allowNull: true }, // null = global skill
      name: { type: DataTypes.STRING(100), allowNull: false },
      category: { type: DataTypes.STRING(50), allowNull: true },
      status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "active" },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deletedAt: { type: DataTypes.DATE, allowNull: true }
    } as any);
    
    await qi.addIndex("skills", ["businessId"], { name: "skills_businessId_idx" } as any);
    await qi.addIndex("skills", ["name", "businessId"], { name: "skills_name_businessId_unique", unique: true } as any);
    
    await qi.addConstraint("skills", {
      fields: ["businessId"],
      type: "foreign key",
      name: "skills_businessId_fkey",
      references: { table: "businesses", field: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE"
    } as any);
  }

  // Create interview_skills table
  const hasInterviewSkills = await tableExists("interview_skills");
  if (!hasInterviewSkills) {
    await qi.createTable("interview_skills", {
      id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      businessId: { type: DataTypes.UUID, allowNull: false },
      interviewId: { type: DataTypes.UUID, allowNull: false },
      skillId: { type: DataTypes.UUID, allowNull: false },
      requiredRating: { type: DataTypes.INTEGER, allowNull: false },
      actualRating: { type: DataTypes.INTEGER, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deletedAt: { type: DataTypes.DATE, allowNull: true }
    } as any);
    
    await qi.addIndex("interview_skills", ["interviewId"], { name: "interview_skills_interviewId_idx" } as any);
    await qi.addIndex("interview_skills", ["skillId"], { name: "interview_skills_skillId_idx" } as any);
    await qi.addIndex("interview_skills", ["businessId"], { name: "interview_skills_businessId_idx" } as any);
    
    await qi.addConstraint("interview_skills", {
      fields: ["businessId"],
      type: "foreign key",
      name: "interview_skills_businessId_fkey",
      references: { table: "businesses", field: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE"
    } as any);
    
    await qi.addConstraint("interview_skills", {
      fields: ["interviewId"],
      type: "foreign key",
      name: "interview_skills_interviewId_fkey",
      references: { table: "hr_interviews", field: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE"
    } as any);
    
    await qi.addConstraint("interview_skills", {
      fields: ["skillId"],
      type: "foreign key",
      name: "interview_skills_skillId_fkey",
      references: { table: "skills", field: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE"
    } as any);
  }

  // Update hr_interviews table with new columns if they don't exist
  const interviewDesc: any = await qi.describeTable("hr_interviews");

  const interviewColsToAdd: Array<[string, any]> = [
    ["currentSession",      { type: DataTypes.INTEGER,      allowNull: false, defaultValue: 1 }],
    ["totalSessions",       { type: DataTypes.INTEGER,      allowNull: false, defaultValue: 1 }],
    ["candidateAcceptedAt", { type: DataTypes.DATE,         allowNull: true }],
    ["candidateDeclinedAt", { type: DataTypes.DATE,         allowNull: true }],
    ["acceptanceToken",     { type: DataTypes.STRING(255),  allowNull: true }],
    ["interviewerUserId",   { type: DataTypes.UUID,         allowNull: true }],
    ["type",                { type: DataTypes.STRING(100),  allowNull: true, defaultValue: "Face to Face" }],
    ["venue",               { type: DataTypes.STRING(500),  allowNull: true }],
    ["department",          { type: DataTypes.STRING(255),  allowNull: true }],
    ["panel",               { type: DataTypes.JSONB,        allowNull: true, defaultValue: [] }],
    ["questions",           { type: DataTypes.JSONB,        allowNull: true, defaultValue: [] }],
    ["additionalNotes",     { type: DataTypes.TEXT,         allowNull: true }],
    ["score",               { type: DataTypes.FLOAT,        allowNull: true }],
  ];

  for (const [col, def] of interviewColsToAdd) {
    if (!interviewDesc[col]) {
      await qi.addColumn("hr_interviews", col, def as any);
      console.log(`hr_interviews: added column "${col}"`);
    }
  }
}

async function ensureInterviewerNotesSchema() {
  const qi = sequelize.getQueryInterface();
  const { DataTypes } = require("sequelize");

  const hasTable = await tableExists("interview_notes");
  if (hasTable) return;

  await qi.createTable("interview_notes", {
    id:             { type: DataTypes.UUID,    allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    businessId:     { type: DataTypes.UUID,    allowNull: false },
    interviewId:    { type: DataTypes.UUID,    allowNull: false },
    interviewerId:  { type: DataTypes.UUID,    allowNull: false },
    questions:      { type: DataTypes.JSONB,   allowNull: false, defaultValue: [] },
    notes:          { type: DataTypes.TEXT,    allowNull: true },
    skillRatings:   { type: DataTypes.JSONB,   allowNull: false, defaultValue: [] },
    candidateScore: { type: DataTypes.FLOAT,   allowNull: true },
    createdAt:      { type: DataTypes.DATE,    allowNull: false, defaultValue: DataTypes.NOW },
    updatedAt:      { type: DataTypes.DATE,    allowNull: false, defaultValue: DataTypes.NOW },
    deletedAt:      { type: DataTypes.DATE,    allowNull: true },
  } as any);

  await qi.addIndex("interview_notes", ["interviewId"],   { name: "interview_notes_interviewId_idx" } as any);
  await qi.addIndex("interview_notes", ["interviewerId"], { name: "interview_notes_interviewerId_idx" } as any);
  await qi.addIndex("interview_notes", ["interviewId", "interviewerId"], { name: "interview_notes_unique_idx", unique: true } as any);

  await qi.addConstraint("interview_notes", {
    fields: ["businessId"], type: "foreign key",
    name: "interview_notes_businessId_fkey",
    references: { table: "businesses", field: "id" },
    onDelete: "CASCADE", onUpdate: "CASCADE",
  } as any);
  await qi.addConstraint("interview_notes", {
    fields: ["interviewId"], type: "foreign key",
    name: "interview_notes_interviewId_fkey",
    references: { table: "hr_interviews", field: "id" },
    onDelete: "CASCADE", onUpdate: "CASCADE",
  } as any);
  await qi.addConstraint("interview_notes", {
    fields: ["interviewerId"], type: "foreign key",
    name: "interview_notes_interviewerId_fkey",
    references: { table: "users", field: "id" },
    onDelete: "CASCADE", onUpdate: "CASCADE",
  } as any);

  console.log("interview_notes table created.");
}

async function ensureRolesDomainSchema() {
  try {
    const qi = sequelize.getQueryInterface();
    const { DataTypes } = require("sequelize");

    const hasTable = await tableExists("roles");
    if (!hasTable) return;

    const desc: any = await qi.describeTable("roles");

    if (!desc["domain"]) {
      await qi.addColumn("roles", "domain", {
        type: DataTypes.STRING(60),
        allowNull: true,
        defaultValue: null,
      } as any);
      console.log('roles: added column "domain"');
    }
  } catch (err) {
    console.error("ensureRolesDomainSchema failed:", err);
  }
}

async function ensureOfferLettersSchema() {
  try {
    const qi = sequelize.getQueryInterface();
    const { DataTypes } = require("sequelize");

    const hasTable = await tableExists("offer_letters");
    if (!hasTable) return;

    const desc: any = await qi.describeTable("offer_letters");

    // Columns added after initial table creation
    const colsToAdd: Array<[string, any]> = [
      ["reportingManagerId", { type: DataTypes.UUID,    allowNull: true, defaultValue: null }],
      ["rejectedAt",         { type: DataTypes.DATE,    allowNull: true }],
      ["workLocation",       { type: DataTypes.STRING,  allowNull: true }],
    ];

    for (const [col, def] of colsToAdd) {
      if (!desc[col]) {
        await qi.addColumn("offer_letters", col, def as any);
        console.log(`offer_letters: added column "${col}"`);
      }
    }

    // Also make roleId, positionId, departmentId, salary, startDate, employmentType nullable if they aren't already
    for (const col of ["roleId", "positionId", "departmentId", "salary", "startDate", "employmentType"]) {
      if (desc[col] && desc[col].allowNull === false) {
        const colType = col === "startDate"
          ? DataTypes.DATEONLY
          : DataTypes.STRING;
        await qi.changeColumn("offer_letters", col, {
          type: colType,
          allowNull: true,
        } as any);
        console.log(`offer_letters: made "${col}" nullable`);
      }
    }
  } catch (err) {
    console.error("ensureOfferLettersSchema failed:", err);
  }
}

async function ensureCandidateOnboardingSchema() {
  try {
    const qi = sequelize.getQueryInterface();
    const { DataTypes } = require("sequelize");

    // Create candidate_onboardings table
    const hasTable = await tableExists("candidate_onboardings");
    if (!hasTable) {
      await qi.createTable("candidate_onboardings", {
        id: { type: DataTypes.UUID, allowNull: false, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
        onboardingId: { type: DataTypes.STRING(64), allowNull: false, unique: true },
        businessId: { type: DataTypes.UUID, allowNull: false },
        offerId: { type: DataTypes.UUID, allowNull: false },
        candidateEmail: { type: DataTypes.STRING, allowNull: false },
        candidateName: { type: DataTypes.STRING, allowNull: false },
        status: {
          type: DataTypes.ENUM(
            "PENDING_CANDIDATE_COMPLETION",
            "IN_PROGRESS",
            "SUBMITTED_FOR_REVIEW",
            "COMPLETED",
            "CANCELLED"
          ),
          allowNull: false,
          defaultValue: "PENDING_CANDIDATE_COMPLETION",
        },
        sections: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
        resources: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
        requiredDocuments: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
        requiredPolicies: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
        candidateData: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
        resourceResponses: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
        progress: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        submittedAt: { type: DataTypes.DATE, allowNull: true },
        initializedById: { type: DataTypes.UUID, allowNull: true },
        metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
        createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        deletedAt: { type: DataTypes.DATE, allowNull: true },
      } as any);

      await qi.addIndex("candidate_onboardings", ["businessId"], { name: "candidate_onboardings_businessId_idx" } as any);
      await qi.addIndex("candidate_onboardings", ["onboardingId"], { name: "candidate_onboardings_onboardingId_unique", unique: true } as any);
      await qi.addIndex("candidate_onboardings", ["offerId"], { name: "candidate_onboardings_offerId_idx" } as any);

      await qi.addConstraint("candidate_onboardings", {
        fields: ["businessId"],
        type: "foreign key",
        name: "candidate_onboardings_businessId_fkey",
        references: { table: "businesses", field: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      } as any);

      console.log("candidate_onboardings table created.");
    }

    // Add onboardingInitialized column to offer_letters if missing
    const hasOfferLetters = await tableExists("offer_letters");
    if (hasOfferLetters) {
      const offerDesc: any = await qi.describeTable("offer_letters");
      if (!offerDesc["onboardingInitialized"]) {
        await qi.addColumn("offer_letters", "onboardingInitialized", {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        } as any);
        console.log('offer_letters: added column "onboardingInitialized"');
      }
    }
  } catch (err) {
    console.error("ensureCandidateOnboardingSchema failed:", err);
  }
}
