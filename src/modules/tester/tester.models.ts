import { DataTypes } from "sequelize";
import { db } from "../../models";

export const TesterAccount: any =
  db.sequelize.models.TesterAccount ||
  db.sequelize.define(
    "TesterAccount",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        unique: true,
      },
      testerLevel: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "STANDARD",
      },
      createdByTesterUserId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
      safetyMode: {
        type: DataTypes.STRING(30),
        allowNull: false,
        defaultValue: "RESTRICTED",
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
    },
    {
      tableName: "tester_accounts",
      timestamps: true,
      paranoid: false,
    },
  );

export type TesterLevel = "MASTER" | "STANDARD";
export type TesterSafetyMode = "RESTRICTED" | "FULL";
