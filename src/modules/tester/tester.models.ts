import { DataTypes } from "sequelize";
import { db } from "../../models";

async function normalizeStandardTesterEmployment(tester: any, options: any = {}) {
  if (String(tester?.testerLevel) !== "STANDARD") return;
  const userId = String(tester?.userId || "");
  if (!userId) return;

  const transaction = options?.transaction;

  await db.BusinessUserProfile.update(
    {
      employmentType: "full_time",
      status: "active",
    },
    {
      where: { userId },
      ...(transaction ? { transaction } : {}),
    },
  );

  const employee = await db.EmployeeRecord.findOne({
    where: { userId },
    ...(transaction ? { transaction } : {}),
  });

  if (employee) {
    await employee.update(
      {
        employmentType: "full_time",
        employmentCategory: null,
        employmentStatus: "active",
        metadata: {
          ...(employee.metadata || {}),
          isTestAccount: true,
          excludeFromReporting: true,
          simulatedAsRealEmployee: true,
        },
      },
      transaction ? { transaction } : {},
    );
  }
}

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
      hooks: {
        afterCreate: normalizeStandardTesterEmployment,
        afterUpdate: normalizeStandardTesterEmployment,
      },
    },
  );

export type TesterLevel = "MASTER" | "STANDARD";
export type TesterSafetyMode = "RESTRICTED" | "FULL";
