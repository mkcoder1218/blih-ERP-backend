"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
const env_1 = require("../config/env");
const sequelize_1 = require("./sequelize");
const seed_1 = require("./seed");
require("../models"); // ensure models loaded + associations registered on shared sequelize instance
async function tableExists(tableName) {
    try {
        await sequelize_1.sequelize.getQueryInterface().describeTable(tableName);
        return true;
    }
    catch {
        return false;
    }
}
async function ensureSectorFocusSchema() {
    const qi = sequelize_1.sequelize.getQueryInterface();
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
        });
    }
    const businessDesc = await qi.describeTable("businesses").catch(() => null);
    if (businessDesc && !businessDesc.sectorFocusId) {
        await qi.addColumn("businesses", "sectorFocusId", { type: DataTypes.UUID, allowNull: true });
        await qi.addConstraint("businesses", {
            fields: ["sectorFocusId"],
            type: "foreign key",
            name: "businesses_sectorFocusId_fkey",
            references: { table: "sector_focuses", field: "id" },
            onDelete: "SET NULL",
            onUpdate: "CASCADE"
        });
    }
}
async function ensurePeopleProfileSchema() {
    const qi = sequelize_1.sequelize.getQueryInterface();
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
        });
        await qi.addIndex("profile_templates", ["businessId"], { name: "profile_templates_businessId_idx" });
        await qi.addConstraint("profile_templates", {
            fields: ["businessId"],
            type: "foreign key",
            name: "profile_templates_businessId_fkey",
            references: { table: "businesses", field: "id" },
            onDelete: "CASCADE",
            onUpdate: "CASCADE"
        });
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
        });
        await qi.addIndex("profile_drafts", ["businessId"], { name: "profile_drafts_businessId_idx" });
        await qi.addIndex("profile_drafts", ["templateId"], { name: "profile_drafts_templateId_idx" });
        await qi.addIndex("profile_drafts", ["createdById"], { name: "profile_drafts_createdById_idx" });
        await qi.addConstraint("profile_drafts", {
            fields: ["businessId"],
            type: "foreign key",
            name: "profile_drafts_businessId_fkey",
            references: { table: "businesses", field: "id" },
            onDelete: "CASCADE",
            onUpdate: "CASCADE"
        });
        await qi.addConstraint("profile_drafts", {
            fields: ["templateId"],
            type: "foreign key",
            name: "profile_drafts_templateId_fkey",
            references: { table: "profile_templates", field: "id" },
            onDelete: "CASCADE",
            onUpdate: "CASCADE"
        });
        await qi.addConstraint("profile_drafts", {
            fields: ["createdById"],
            type: "foreign key",
            name: "profile_drafts_createdById_fkey",
            references: { table: "users", field: "id" },
            onDelete: "RESTRICT",
            onUpdate: "CASCADE"
        });
    }
}
async function initDatabase() {
    try {
        await (0, sequelize_1.authenticateDB)();
        // eslint-disable-next-line no-console
        console.log("DB connected");
        if (env_1.env.nodeEnv === "production" && env_1.env.dbSync) {
            throw new Error("Critical Vulnerability: DB_SYNC strictly prohibited in production context. Migrations exclusively supported.");
        }
        if (env_1.env.nodeEnv === "development" && env_1.env.dbSync) {
            // NOTE: sequelize.sync({ alter: true }) can crash on some Postgres setups when
            // existing index DDL can't be parsed by Sequelize. Keep dev sync non-altering.
            await sequelize_1.sequelize.sync();
            // eslint-disable-next-line no-console
            console.log("DB synced");
        }
        if (env_1.env.nodeEnv === "development") {
            await ensureSectorFocusSchema();
            await ensurePeopleProfileSchema();
        }
        const canSeed = await tableExists("permissions");
        if (canSeed) {
            await (0, seed_1.seedDefaults)();
            // eslint-disable-next-line no-console
            console.log("DB seeded");
        }
        else {
            // eslint-disable-next-line no-console
            console.log("Tables missing. Set DB_SYNC=true in development or run migrations.");
        }
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("DB init failed", err);
        throw err;
    }
}
