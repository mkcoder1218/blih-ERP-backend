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
