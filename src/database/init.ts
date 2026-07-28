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
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      name: { type: DataTypes.STRING(120), allowNull: false },
      key: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      description: { type: DataTypes.STRING(255), allowNull: true },
      status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "active",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      deletedAt: { type: DataTypes.DATE, allowNull: true },
    } as any);
  }

  const businessDesc = await qi
    .describeTable("businesses")
    .catch(() => null as any);
  if (businessDesc && !businessDesc.sectorFocusId) {
    await qi.addColumn("businesses", "sectorFocusId", {
      type: DataTypes.UUID,
      allowNull: true,
    } as any);
    await qi.addConstraint("businesses", {
      fields: ["sectorFocusId"],
      type: "foreign key",
      name: "businesses_sectorFocusId_fkey",
      references: { table: "sector_focuses", field: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    } as any);
  }
}

async function ensurePeopleProfileSchema() {
  const qi = sequelize.getQueryInterface();
  const { DataTypes } = require("sequelize");

  const hasTemplates = await tableExists("profile_templates");
  if (!hasTemplates) {
    await qi.createTable("profile_templates", {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      businessId: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING(160), allowNull: false },
      description: { type: DataTypes.STRING(500), allowNull: true },
      fields: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      deletedAt: { type: DataTypes.DATE, allowNull: true },
    } as any);
    await qi.addIndex("profile_templates", ["businessId"], {
      name: "profile_templates_businessId_idx",
    } as any);
    await qi.addConstraint("profile_templates", {
      fields: ["businessId"],
      type: "foreign key",
      name: "profile_templates_businessId_fkey",
      references: { table: "businesses", field: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    } as any);
  }

  const hasDrafts = await tableExists("profile_drafts");
  if (!hasDrafts) {
    await qi.createTable("profile_drafts", {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      businessId: { type: DataTypes.UUID, allowNull: false },
      templateId: { type: DataTypes.UUID, allowNull: false },
      status: {
        type: DataTypes.STRING(40),
        allowNull: false,
        defaultValue: "draft",
      },
      data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdById: { type: DataTypes.UUID, allowNull: false },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      deletedAt: { type: DataTypes.DATE, allowNull: true },
    } as any);
    await qi.addIndex("profile_drafts", ["businessId"], {
      name: "profile_drafts_businessId_idx",
    } as any);
    await qi.addIndex("profile_drafts", ["templateId"], {
      name: "profile_drafts_templateId_idx",
    } as any);
    await qi.addIndex("profile_drafts", ["createdById"], {
      name: "profile_drafts_createdById_idx",
    } as any);
    await qi.addConstraint("profile_drafts", {
      fields: ["businessId"],
      type: "foreign key",
      name: "profile_drafts_businessId_fkey",
      references: { table: "businesses", field: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    } as any);
    await qi.addConstraint("profile_drafts", {
      fields: ["templateId"],
      type: "foreign key",
      name: "profile_drafts_templateId_fkey",
      references: { table: "profile_templates", field: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    } as any);
    await qi.addConstraint("profile_drafts", {
      fields: ["createdById"],
      type: "foreign key",
      name: "profile_drafts_createdById_fkey",
      references: { table: "users", field: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    } as any);
  }
}

export async function initDatabase() {
  try {
    await authenticateDB();
    // eslint-disable-next-line no-console
    console.log("DB connected");

    if (env.nodeEnv === "production" && env.dbSync) {
      throw new Error(
        "Critical Vulnerability: DB_SYNC strictly prohibited in production context. Migrations exclusively supported.",
      );
    }

    // In non-production environments, allow DB_SYNC to bootstrap local/dev databases
    // even if NODE_ENV isn't exactly "development" (e.g. "staging", "local").
    if (env.nodeEnv !== "production" && env.dbSync) {
      // Use { alter: false } — only create tables that don't exist yet.
      // alter: true is DANGEROUS: it drops columns/recreates tables and wipes data.
      // New columns/tables are handled by the ensureXxx() functions below.
      await sequelize.sync({ alter: false });
      // eslint-disable-next-line no-console
      console.log("DB synced (create-only, no alter)");
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
      await ensurePolicySchema();
      await ensureNewModelsSchema();
    }

    const canSeed = await tableExists("permissions");
    if (canSeed) {
      await seedDefaults();
      // eslint-disable-next-line no-console
      console.log("DB seeded");
    } else {
      // eslint-disable-next-line no-console
      console.log(
        "Tables missing. Set DB_SYNC=true in development or run migrations.",
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("DB init failed", err);
    throw err;
  }
}

async function ensurePolicySchema() {
  const qi = sequelize.getQueryInterface();
  const { DataTypes } = require("sequelize");

  const hasPolicies = await tableExists("policies");
  if (!hasPolicies) {
    await qi.createTable("policies", {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      businessId: { type: DataTypes.UUID, allowNull: true },
      policyType: { type: DataTypes.STRING(120), allowNull: false },
      title: { type: DataTypes.STRING(255), allowNull: false },
      slug: { type: DataTypes.STRING(160), allowNull: false },
      version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      status: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "draft" },
      isRequired: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      publishedAt: { type: DataTypes.DATE, allowNull: true },
      contentHtml: { type: DataTypes.TEXT, allowNull: true },
      contentJson: { type: DataTypes.JSONB, allowNull: true },
      contentText: { type: DataTypes.TEXT, allowNull: true },
      createdById: { type: DataTypes.UUID, allowNull: true },
      updatedById: { type: DataTypes.UUID, allowNull: true },
      acceptanceCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deletedAt: { type: DataTypes.DATE, allowNull: true },
    } as any);
    await qi.addIndex("policies", ["businessId"], { name: "policies_businessId_idx" } as any);
    await qi.addIndex("policies", ["policyType", "status"], { name: "policies_policyType_status_idx" } as any);
    await qi.addIndex("policies", ["slug"], { name: "policies_slug_idx" } as any);
  }

  const hasAcceptances = await tableExists("policy_acceptances");
  if (!hasAcceptances) {
    await qi.createTable("policy_acceptances", {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      policyId: { type: DataTypes.UUID, allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: false },
      businessId: { type: DataTypes.UUID, allowNull: true },
      policyVersion: { type: DataTypes.INTEGER, allowNull: false },
      acceptedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deletedAt: { type: DataTypes.DATE, allowNull: true },
    } as any);
    await qi.addIndex("policy_acceptances", ["policyId"], { name: "policy_acceptances_policyId_idx" } as any);
    await qi.addIndex("policy_acceptances", ["userId"], { name: "policy_acceptances_userId_idx" } as any);
    await qi.addIndex("policy_acceptances", ["businessId"], { name: "policy_acceptances_businessId_idx" } as any);
    await qi.addIndex("policy_acceptances", ["policyId", "userId"], {
      name: "policy_acceptances_policyId_userId_unique",
      unique: true,
    } as any);
  }
}

async function ensureRecruitmentSchema() {
  const qi = sequelize.getQueryInterface();
  const { DataTypes } = require("sequelize");

  const hasTemplates = await tableExists("hr_recruitment_templates");
  if (!hasTemplates) {
    await qi.createTable("hr_recruitment_templates", {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      businessId: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      requestConfig: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      jobDetailsConfig: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      applicationFormConfig: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      createdByUserId: { type: DataTypes.UUID, allowNull: false },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      deletedAt: { type: DataTypes.DATE, allowNull: true },
    } as any);
    await qi.addIndex("hr_recruitment_templates", ["businessId"], {
      name: "hr_recruitment_templates_businessId_idx",
    } as any);
    await qi.addConstraint("hr_recruitment_templates", {
      fields: ["businessId"],
      type: "foreign key",
      name: "hr_recruitment_templates_businessId_fkey",
      references: { table: "businesses", field: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
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
        `ALTER TABLE "file_assets" DROP CONSTRAINT IF EXISTS "file_assets_uploadedByUserId_fkey";`,
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

    console.log(
      "file_assets.uploadedByUserId patched to allow NULL for public uploads.",
    );
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
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      businessId: { type: DataTypes.UUID, allowNull: true }, // null = global skill
      name: { type: DataTypes.STRING(100), allowNull: false },
      category: { type: DataTypes.STRING(50), allowNull: true },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "active",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      deletedAt: { type: DataTypes.DATE, allowNull: true },
    } as any);

    await qi.addIndex("skills", ["businessId"], {
      name: "skills_businessId_idx",
    } as any);
    await qi.addIndex("skills", ["name", "businessId"], {
      name: "skills_name_businessId_unique",
      unique: true,
    } as any);

    await qi.addConstraint("skills", {
      fields: ["businessId"],
      type: "foreign key",
      name: "skills_businessId_fkey",
      references: { table: "businesses", field: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    } as any);
  }

  // Create interview_skills table
  const hasInterviewSkills = await tableExists("interview_skills");
  if (!hasInterviewSkills) {
    await qi.createTable("interview_skills", {
      id: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
      },
      businessId: { type: DataTypes.UUID, allowNull: false },
      interviewId: { type: DataTypes.UUID, allowNull: false },
      skillId: { type: DataTypes.UUID, allowNull: false },
      requiredRating: { type: DataTypes.INTEGER, allowNull: false },
      actualRating: { type: DataTypes.INTEGER, allowNull: true },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      deletedAt: { type: DataTypes.DATE, allowNull: true },
    } as any);

    await qi.addIndex("interview_skills", ["interviewId"], {
      name: "interview_skills_interviewId_idx",
    } as any);
    await qi.addIndex("interview_skills", ["skillId"], {
      name: "interview_skills_skillId_idx",
    } as any);
    await qi.addIndex("interview_skills", ["businessId"], {
      name: "interview_skills_businessId_idx",
    } as any);

    await qi.addConstraint("interview_skills", {
      fields: ["businessId"],
      type: "foreign key",
      name: "interview_skills_businessId_fkey",
      references: { table: "businesses", field: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    } as any);

    await qi.addConstraint("interview_skills", {
      fields: ["interviewId"],
      type: "foreign key",
      name: "interview_skills_interviewId_fkey",
      references: { table: "hr_interviews", field: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    } as any);

    await qi.addConstraint("interview_skills", {
      fields: ["skillId"],
      type: "foreign key",
      name: "interview_skills_skillId_fkey",
      references: { table: "skills", field: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    } as any);
  }

  // Update hr_interviews table with new columns if they don't exist
  const interviewDesc: any = await qi.describeTable("hr_interviews");

  const interviewColsToAdd: Array<[string, any]> = [
    [
      "currentSession",
      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    ],
    [
      "totalSessions",
      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    ],
    ["candidateAcceptedAt", { type: DataTypes.DATE, allowNull: true }],
    ["candidateDeclinedAt", { type: DataTypes.DATE, allowNull: true }],
    ["acceptanceToken", { type: DataTypes.STRING(255), allowNull: true }],
    ["interviewerUserId", { type: DataTypes.UUID, allowNull: true }],
    [
      "type",
      {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: "Face to Face",
      },
    ],
    ["venue", { type: DataTypes.STRING(500), allowNull: true }],
    ["department", { type: DataTypes.STRING(255), allowNull: true }],
    ["panel", { type: DataTypes.JSONB, allowNull: true, defaultValue: [] }],
    ["questions", { type: DataTypes.JSONB, allowNull: true, defaultValue: [] }],
    ["additionalNotes", { type: DataTypes.TEXT, allowNull: true }],
    ["score", { type: DataTypes.FLOAT, allowNull: true }],
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
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4,
    },
    businessId: { type: DataTypes.UUID, allowNull: false },
    interviewId: { type: DataTypes.UUID, allowNull: false },
    interviewerId: { type: DataTypes.UUID, allowNull: false },
    questions: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    notes: { type: DataTypes.TEXT, allowNull: true },
    skillRatings: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    candidateScore: { type: DataTypes.FLOAT, allowNull: true },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    deletedAt: { type: DataTypes.DATE, allowNull: true },
  } as any);

  await qi.addIndex("interview_notes", ["interviewId"], {
    name: "interview_notes_interviewId_idx",
  } as any);
  await qi.addIndex("interview_notes", ["interviewerId"], {
    name: "interview_notes_interviewerId_idx",
  } as any);
  await qi.addIndex("interview_notes", ["interviewId", "interviewerId"], {
    name: "interview_notes_unique_idx",
    unique: true,
  } as any);

  await qi.addConstraint("interview_notes", {
    fields: ["businessId"],
    type: "foreign key",
    name: "interview_notes_businessId_fkey",
    references: { table: "businesses", field: "id" },
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  } as any);
  await qi.addConstraint("interview_notes", {
    fields: ["interviewId"],
    type: "foreign key",
    name: "interview_notes_interviewId_fkey",
    references: { table: "hr_interviews", field: "id" },
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  } as any);
  await qi.addConstraint("interview_notes", {
    fields: ["interviewerId"],
    type: "foreign key",
    name: "interview_notes_interviewerId_fkey",
    references: { table: "users", field: "id" },
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
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
      [
        "reportingManagerId",
        { type: DataTypes.UUID, allowNull: true, defaultValue: null },
      ],
      ["rejectedAt", { type: DataTypes.DATE, allowNull: true }],
      ["workLocation", { type: DataTypes.STRING, allowNull: true }],
    ];

    for (const [col, def] of colsToAdd) {
      if (!desc[col]) {
        await qi.addColumn("offer_letters", col, def as any);
        console.log(`offer_letters: added column "${col}"`);
      }
    }

    // Also make roleId, positionId, departmentId, salary, startDate, employmentType nullable if they aren't already
    for (const col of [
      "roleId",
      "positionId",
      "departmentId",
      "salary",
      "startDate",
      "employmentType",
    ]) {
      if (desc[col] && desc[col].allowNull === false) {
        const colType =
          col === "startDate" ? DataTypes.DATEONLY : DataTypes.STRING;
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
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4,
        },
        onboardingId: {
          type: DataTypes.STRING(64),
          allowNull: false,
          unique: true,
        },
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
            "CANCELLED",
          ),
          allowNull: false,
          defaultValue: "PENDING_CANDIDATE_COMPLETION",
        },
        sections: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
        resources: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: [],
        },
        requiredDocuments: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: [],
        },
        requiredPolicies: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: [],
        },
        candidateData: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: {},
        },
        resourceResponses: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: [],
        },
        progress: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        submittedAt: { type: DataTypes.DATE, allowNull: true },
        completedAt: { type: DataTypes.DATE, allowNull: true },
        initializedById: { type: DataTypes.UUID, allowNull: true },
        metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        deletedAt: { type: DataTypes.DATE, allowNull: true },
      } as any);

      await qi.addIndex("candidate_onboardings", ["businessId"], {
        name: "candidate_onboardings_businessId_idx",
      } as any);
      await qi.addIndex("candidate_onboardings", ["onboardingId"], {
        name: "candidate_onboardings_onboardingId_unique",
        unique: true,
      } as any);
      await qi.addIndex("candidate_onboardings", ["offerId"], {
        name: "candidate_onboardings_offerId_idx",
      } as any);

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

    if (hasTable) {
      const onboardingDesc: any = await qi.describeTable("candidate_onboardings");
      if (!onboardingDesc.completedAt) {
        await qi.addColumn("candidate_onboardings", "completedAt", {
          type: DataTypes.DATE,
          allowNull: true,
        } as any);
        console.log('candidate_onboardings: added column "completedAt"');
      }
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

/**
 * ensureNewModelsSchema — safe additive migrations for models added after initial schema.
 * Only creates tables/columns that don't exist — never drops or alters existing ones.
 */
async function ensureNewModelsSchema() {
  const qi = sequelize.getQueryInterface();
  const { DataTypes } = require("sequelize");

  // ── PromotionRequest ──────────────────────────────────────────────────────────
  if (!await tableExists("hr_promotion_requests")) {
    await qi.createTable("hr_promotion_requests", {
      id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      businessId:        { type: DataTypes.UUID, allowNull: false },
      employeeUserId:    { type: DataTypes.UUID, allowNull: false },
      requestedByUserId: { type: DataTypes.UUID, allowNull: true  },
      currentTitle:      { type: DataTypes.STRING(255), allowNull: false },
      targetTitle:       { type: DataTypes.STRING(255), allowNull: false },
      department:        { type: DataTypes.STRING(255), allowNull: true  },
      justification:     { type: DataTypes.TEXT,        allowNull: false },
      kpiScore:          { type: DataTypes.FLOAT,       allowNull: true  },
      yearsInRole:       { type: DataTypes.FLOAT,       allowNull: true  },
      effectiveDate:     { type: DataTypes.DATEONLY,    allowNull: true  },
      approvalStage:     { type: DataTypes.STRING(50),  defaultValue: "department_head" },
      status:            { type: DataTypes.STRING(50),  defaultValue: "pending" },
      deptHeadComment:   { type: DataTypes.TEXT,        allowNull: true  },
      adminComment:      { type: DataTypes.TEXT,        allowNull: true  },
      rejectionReason:   { type: DataTypes.TEXT,        allowNull: true  },
      metadata:          { type: DataTypes.JSONB,       defaultValue: {} },
      createdAt:         { type: DataTypes.DATE,        allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt:         { type: DataTypes.DATE,        allowNull: false, defaultValue: DataTypes.NOW },
      deletedAt:         { type: DataTypes.DATE,        allowNull: true  },
    } as any);
    console.log("hr_promotion_requests table created.");
  }

  // ── HREvent ──────────────────────────────────────────────────────────────────
  if (!await tableExists("hr_events")) {
    await qi.createTable("hr_events", {
      id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      businessId:      { type: DataTypes.UUID, allowNull: false },
      createdByUserId: { type: DataTypes.UUID, allowNull: false },
      employeeUserId:  { type: DataTypes.UUID, allowNull: true  },
      departmentId:    { type: DataTypes.UUID, allowNull: true  },
      eventType:       { type: DataTypes.STRING(50),  allowNull: false, defaultValue: "company_event" },
      title:           { type: DataTypes.STRING(255), allowNull: false },
      description:     { type: DataTypes.TEXT,        allowNull: true  },
      eventDate:       { type: DataTypes.DATEONLY,    allowNull: false },
      endDate:         { type: DataTypes.DATEONLY,    allowNull: true  },
      isRecurring:     { type: DataTypes.BOOLEAN,     defaultValue: false },
      visibility:      { type: DataTypes.STRING(20),  defaultValue: "all" },
      emoji:           { type: DataTypes.STRING(10),  allowNull: true  },
      color:           { type: DataTypes.STRING(100), allowNull: true  },
      metadata:        { type: DataTypes.JSONB,       defaultValue: {} },
      createdAt:       { type: DataTypes.DATE,        allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt:       { type: DataTypes.DATE,        allowNull: false, defaultValue: DataTypes.NOW },
      deletedAt:       { type: DataTypes.DATE,        allowNull: true  },
    } as any);
    await qi.addIndex("hr_events", ["businessId"],  { name: "hr_events_businessId_idx"  } as any);
    await qi.addIndex("hr_events", ["eventDate"],   { name: "hr_events_eventDate_idx"   } as any);
    await qi.addIndex("hr_events", ["eventType"],   { name: "hr_events_eventType_idx"   } as any);
    console.log("hr_events table created.");
  }

  // ── DisciplinaryCase ─────────────────────────────────────────────────────────
  if (!await tableExists("hr_disciplinary_cases")) {
    await qi.createTable("hr_disciplinary_cases", {
      id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      businessId:        { type: DataTypes.UUID, allowNull: false },
      employeeUserId:    { type: DataTypes.UUID, allowNull: false },
      reportedByUserId:  { type: DataTypes.UUID, allowNull: false },
      caseType:          { type: DataTypes.STRING(100), allowNull: false },
      severity:          { type: DataTypes.STRING(50),  defaultValue: "minor" },
      title:             { type: DataTypes.STRING(255), allowNull: false },
      description:       { type: DataTypes.TEXT,        allowNull: false },
      actionTaken:       { type: DataTypes.TEXT,        allowNull: true  },
      status:            { type: DataTypes.STRING(50),  defaultValue: "open" },
      metadata:          { type: DataTypes.JSONB,       defaultValue: {} },
      createdAt:         { type: DataTypes.DATE,        allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt:         { type: DataTypes.DATE,        allowNull: false, defaultValue: DataTypes.NOW },
      deletedAt:         { type: DataTypes.DATE,        allowNull: true  },
    } as any);
    await qi.addIndex("hr_disciplinary_cases", ["businessId"],     { name: "hr_disciplinary_cases_businessId_idx"    } as any);
    await qi.addIndex("hr_disciplinary_cases", ["employeeUserId"], { name: "hr_disciplinary_cases_employeeUserId_idx" } as any);
    console.log("hr_disciplinary_cases table created.");
  }

  // ── TrainingRecord (if missing columns) ──────────────────────────────────────
  if (await tableExists("hr_training_records")) {
    const desc: any = await qi.describeTable("hr_training_records").catch(() => ({}));
    if (!desc["trainingType"]) {
      await qi.addColumn("hr_training_records", "trainingType", { type: DataTypes.STRING(100), allowNull: true } as any);
    }
    if (!desc["resultData"]) {
      await qi.addColumn("hr_training_records", "resultData", { type: DataTypes.JSONB, defaultValue: {} } as any);
    }
  }

  // ── HREvent color column widened to STRING(100) if created narrow ──────────
  if (await tableExists("hr_events")) {
    try {
      await qi.changeColumn("hr_events", "color", { type: DataTypes.STRING(100), allowNull: true } as any);
    } catch { /* already correct width or table just created */ }
  }

  // ── UserCalendarEvent ───────────────────────────────────────────────────────
  if (!await tableExists("user_calendar_events")) {
    await qi.createTable("user_calendar_events", {
      id:                 { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      businessId:         { type: DataTypes.UUID, allowNull: false },
      employeeUserId:     { type: DataTypes.UUID, allowNull: false },
      title:              { type: DataTypes.STRING(255), allowNull: false },
      description:        { type: DataTypes.TEXT, allowNull: true },
      location:           { type: DataTypes.STRING(255), allowNull: true },
      startAt:            { type: DataTypes.DATE, allowNull: false },
      endAt:              { type: DataTypes.DATE, allowNull: false },
      allDay:             { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      itemType:           { type: DataTypes.STRING(30), allowNull: false, defaultValue: "EVENT" },
      availabilityStatus: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "AVAILABLE" },
      projectId:          { type: DataTypes.UUID, allowNull: true },
      projectTaskId:      { type: DataTypes.UUID, allowNull: true },
      meetingRequestId:   { type: DataTypes.UUID, allowNull: true },
      organizerUserId:    { type: DataTypes.UUID, allowNull: true },
      color:              { type: DataTypes.STRING(100), allowNull: true },
      googleEventId:      { type: DataTypes.STRING(255), allowNull: true },
      googleCalendarId:   { type: DataTypes.STRING(255), allowNull: true },
      googleSyncStatus:   { type: DataTypes.STRING(30), allowNull: false, defaultValue: "NOT_SYNCED" },
      googleSyncError:    { type: DataTypes.TEXT, allowNull: true },
      lastGoogleSyncedAt: { type: DataTypes.DATE, allowNull: true },
      syncSource:         { type: DataTypes.STRING(30), allowNull: false, defaultValue: "BLIH" },
      googleUpdatedAt:    { type: DataTypes.DATE, allowNull: true },
      googleETag:         { type: DataTypes.STRING(255), allowNull: true },
      recurrenceRule:     { type: DataTypes.TEXT, allowNull: true },
      googleRecurringEventId: { type: DataTypes.STRING(255), allowNull: true },
      googleOriginalStartTime: { type: DataTypes.JSONB, allowNull: true },
      isRecurring:        { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      isRecurringInstance:{ type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      deletedSource:      { type: DataTypes.STRING(30), allowNull: true },
      googleDeletedAt:    { type: DataTypes.DATE, allowNull: true },
      googleSyncedAt:     { type: DataTypes.DATE, allowNull: true },
      metadata:           { type: DataTypes.JSONB, defaultValue: {} },
      createdAt:          { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt:          { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deletedAt:          { type: DataTypes.DATE, allowNull: true },
    } as any);
    await qi.addIndex("user_calendar_events", ["businessId", "employeeUserId"], { name: "user_calendar_events_business_employee_idx" } as any);
    await qi.addIndex("user_calendar_events", ["startAt", "endAt"], { name: "user_calendar_events_range_idx" } as any);
    console.log("user_calendar_events table created.");
  } else {
    const desc: any = await qi.describeTable("user_calendar_events").catch(() => ({}));
    const columns: Record<string, any> = {
      itemType: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "EVENT" },
      projectId: { type: DataTypes.UUID, allowNull: true },
      projectTaskId: { type: DataTypes.UUID, allowNull: true },
      meetingRequestId: { type: DataTypes.UUID, allowNull: true },
      organizerUserId: { type: DataTypes.UUID, allowNull: true },
      googleSyncStatus: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "NOT_SYNCED" },
      googleSyncError: { type: DataTypes.TEXT, allowNull: true },
      lastGoogleSyncedAt: { type: DataTypes.DATE, allowNull: true },
      syncSource: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "BLIH" },
      googleUpdatedAt: { type: DataTypes.DATE, allowNull: true },
      googleETag: { type: DataTypes.STRING(255), allowNull: true },
      recurrenceRule: { type: DataTypes.TEXT, allowNull: true },
      googleRecurringEventId: { type: DataTypes.STRING(255), allowNull: true },
      googleOriginalStartTime: { type: DataTypes.JSONB, allowNull: true },
      isRecurring: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      isRecurringInstance: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      deletedSource: { type: DataTypes.STRING(30), allowNull: true },
      googleDeletedAt: { type: DataTypes.DATE, allowNull: true },
    };
    for (const [name, def] of Object.entries(columns)) {
      if (!desc[name]) await qi.addColumn("user_calendar_events", name, def as any);
    }
  }

  if (!await tableExists("calendar_sync_retry_jobs")) {
    await qi.createTable("calendar_sync_retry_jobs", {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      businessId: { type: DataTypes.UUID, allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: false },
      localEventId: { type: DataTypes.UUID, allowNull: true },
      googleEventId: { type: DataTypes.STRING(255), allowNull: true },
      actionType: { type: DataTypes.STRING(60), allowNull: false },
      payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "PENDING" },
      attemptCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      maxAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
      nextRunAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      lastError: { type: DataTypes.TEXT, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    } as any);
  }

  if (!await tableExists("calendar_sync_audit_logs")) {
    await qi.createTable("calendar_sync_audit_logs", {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      businessId: { type: DataTypes.UUID, allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: true },
      localEventId: { type: DataTypes.UUID, allowNull: true },
      googleEventId: { type: DataTypes.STRING(255), allowNull: true },
      direction: { type: DataTypes.STRING(40), allowNull: false },
      action: { type: DataTypes.STRING(40), allowNull: false },
      status: { type: DataTypes.STRING(30), allowNull: false },
      message: { type: DataTypes.STRING(500), allowNull: true },
      errorDetails: { type: DataTypes.TEXT, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    } as any);
  }

  // ── UserCalendarMeetingRequest ──────────────────────────────────────────────
  if (!await tableExists("user_calendar_meeting_requests")) {
    await qi.createTable("user_calendar_meeting_requests", {
      id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      businessId:       { type: DataTypes.UUID, allowNull: false },
      requesterUserId:  { type: DataTypes.UUID, allowNull: false },
      recipientUserId:  { type: DataTypes.UUID, allowNull: false },
      title:            { type: DataTypes.STRING(255), allowNull: false },
      description:      { type: DataTypes.TEXT, allowNull: true },
      location:         { type: DataTypes.STRING(255), allowNull: true },
      startAt:          { type: DataTypes.DATE, allowNull: false },
      endAt:            { type: DataTypes.DATE, allowNull: false },
      status:           { type: DataTypes.STRING(30), allowNull: false, defaultValue: "PENDING" },
      requesterEventId: { type: DataTypes.UUID, allowNull: true },
      recipientEventId: { type: DataTypes.UUID, allowNull: true },
      responseNote:     { type: DataTypes.TEXT, allowNull: true },
      respondedAt:      { type: DataTypes.DATE, allowNull: true },
      metadata:         { type: DataTypes.JSONB, defaultValue: {} },
      createdAt:        { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updatedAt:        { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      deletedAt:        { type: DataTypes.DATE, allowNull: true },
    } as any);
    await qi.addIndex("user_calendar_meeting_requests", ["businessId", "recipientUserId", "status"], { name: "calendar_meetings_recipient_status_idx" } as any);
    await qi.addIndex("user_calendar_meeting_requests", ["businessId", "requesterUserId", "status"], { name: "calendar_meetings_requester_status_idx" } as any);
    console.log("user_calendar_meeting_requests table created.");
  }

  // ── Brain Articles schema hardening ────────────────────────────────────────
  if (await tableExists("brain_articles")) {
    const desc: any = await qi.describeTable("brain_articles").catch(() => null);
    if (desc) {
      const colsToAdd: Array<[string, any]> = [
        ["contentText", { type: DataTypes.TEXT, allowNull: true }],
        ["submittedAt", { type: DataTypes.DATE, allowNull: true }],
        ["submittedByUserId", { type: DataTypes.UUID, allowNull: true }],
        ["reviewedAt", { type: DataTypes.DATE, allowNull: true }],
        ["reviewedByUserId", { type: DataTypes.UUID, allowNull: true }],
        ["publishedByUserId", { type: DataTypes.UUID, allowNull: true }],
        ["archivedAt", { type: DataTypes.DATE, allowNull: true }],
        ["archivedByUserId", { type: DataTypes.UUID, allowNull: true }],
      ];
      for (const [col, spec] of colsToAdd) {
        if (!desc[col]) {
          await qi.addColumn("brain_articles", col, spec);
        }
      }
    }
  }
}
