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
