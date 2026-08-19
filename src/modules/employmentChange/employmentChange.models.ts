import { DataTypes } from "sequelize";
import { db } from "../../models";

export const EmploymentChangeRequest: any =
  db.sequelize.models.EmploymentChangeRequest ||
  db.sequelize.define(
    "EmploymentChangeRequest",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      businessId: { type: DataTypes.UUID, allowNull: false },
      employeeUserId: { type: DataTypes.UUID, allowNull: false },
      requestedByUserId: { type: DataTypes.UUID, allowNull: false },
      requestKind: { type: DataTypes.STRING(30), allowNull: false },
      titleChangeType: { type: DataTypes.STRING(40), allowNull: true },
      currentPositionId: { type: DataTypes.UUID, allowNull: true },
      currentTitle: { type: DataTypes.STRING(255), allowNull: true },
      targetPositionId: { type: DataTypes.UUID, allowNull: true },
      targetTitle: { type: DataTypes.STRING(255), allowNull: true },
      currentDepartmentId: { type: DataTypes.UUID, allowNull: true },
      targetDepartmentId: { type: DataTypes.UUID, allowNull: true },
      currentSalary: { type: DataTypes.FLOAT, allowNull: true },
      requestedSalary: { type: DataTypes.FLOAT, allowNull: true },
      recommendedSalary: { type: DataTypes.FLOAT, allowNull: true },
      reason: { type: DataTypes.TEXT, allowNull: false },
      effectiveDate: { type: DataTypes.DATEONLY, allowNull: false },
      attachmentUrl: { type: DataTypes.STRING(1000), allowNull: true },
      status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "PENDING" },
      approvalStage: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "MANAGER" },
      currentApproverUserId: { type: DataTypes.UUID, allowNull: true },
      currentApproverRoleKey: { type: DataTypes.STRING(80), allowNull: true },
      approvedAt: { type: DataTypes.DATE, allowNull: true },
      scheduledAt: { type: DataTypes.DATE, allowNull: true },
      appliedAt: { type: DataTypes.DATE, allowNull: true },
      rejectedAt: { type: DataTypes.DATE, allowNull: true },
      cancelledAt: { type: DataTypes.DATE, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    },
    {
      tableName: "hr_employment_change_requests",
      timestamps: true,
      paranoid: true,
    },
  );

export const EmploymentChangeAction: any =
  db.sequelize.models.EmploymentChangeAction ||
  db.sequelize.define(
    "EmploymentChangeAction",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      businessId: { type: DataTypes.UUID, allowNull: false },
      requestId: { type: DataTypes.UUID, allowNull: false },
      actorUserId: { type: DataTypes.UUID, allowNull: true },
      stage: { type: DataTypes.STRING(30), allowNull: true },
      action: { type: DataTypes.STRING(30), allowNull: false },
      comment: { type: DataTypes.TEXT, allowNull: true },
      beforeData: { type: DataTypes.JSONB, allowNull: true },
      afterData: { type: DataTypes.JSONB, allowNull: true },
    },
    {
      tableName: "hr_employment_change_actions",
      timestamps: true,
      paranoid: false,
    },
  );
