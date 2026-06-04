import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type OvertimeRequestModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): OvertimeRequestModel => {
  const OvertimeRequest = sequelize.define(
    "OvertimeRequest",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false },
      employeeUserId: { type: dataTypes.UUID, allowNull: false },
      overtimeDate: { type: dataTypes.DATEONLY, allowNull: false },
      startTime: { type: dataTypes.STRING(10), allowNull: false }, // HH:mm
      endTime: { type: dataTypes.STRING(10), allowNull: false },   // HH:mm
      totalMinutes: { type: dataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      overtimeType: {
        type: dataTypes.STRING(50),
        allowNull: false,
        defaultValue: "Regular",
        // Regular | Weekend | Public Holiday
      },
      reason: { type: dataTypes.TEXT, allowNull: false },
      /**
       * approval_stage tracks which stage the request is currently sitting at:
       *   department_head  → waiting for dept head
       *   admin            → waiting for CEO / Business Admin
       *   finance          → waiting for finance
       *   approved         → fully approved by all 3 stages
       *   rejected         → rejected at any stage
       *   cancelled        → withdrawn by the employee
       */
      approvalStage: {
        type: dataTypes.STRING(50),
        allowNull: false,
        defaultValue: "department_head",
      },
      status: {
        type: dataTypes.STRING(50),
        allowNull: false,
        defaultValue: "pending",
        // pending | approved | rejected | cancelled
      },
      // IDs of users who took action at each stage
      deptHeadApprovedBy: { type: dataTypes.UUID, allowNull: true },
      deptHeadActionAt: { type: dataTypes.DATE, allowNull: true },
      deptHeadComment: { type: dataTypes.TEXT, allowNull: true },

      adminApprovedBy: { type: dataTypes.UUID, allowNull: true },
      adminActionAt: { type: dataTypes.DATE, allowNull: true },
      adminComment: { type: dataTypes.TEXT, allowNull: true },

      financeApprovedBy: { type: dataTypes.UUID, allowNull: true },
      financeActionAt: { type: dataTypes.DATE, allowNull: true },
      financeComment: { type: dataTypes.TEXT, allowNull: true },

      rejectedAt: { type: dataTypes.DATE, allowNull: true },
      rejectedBy: { type: dataTypes.UUID, allowNull: true },
      rejectionReason: { type: dataTypes.TEXT, allowNull: true },
    },
    {
      tableName: "overtime_requests",
      timestamps: true,
      paranoid: true,
    }
  ) as OvertimeRequestModel;

  OvertimeRequest.associate = (models: any) => {
    models.OvertimeRequest.belongsTo(models.Business, { foreignKey: "businessId" });
    models.OvertimeRequest.belongsTo(models.User, {
      foreignKey: "employeeUserId",
      as: "employee",
    });
    models.OvertimeRequest.belongsTo(models.User, {
      foreignKey: "deptHeadApprovedBy",
      as: "deptHeadApprover",
    });
    models.OvertimeRequest.belongsTo(models.User, {
      foreignKey: "adminApprovedBy",
      as: "adminApprover",
    });
    models.OvertimeRequest.belongsTo(models.User, {
      foreignKey: "financeApprovedBy",
      as: "financeApprover",
    });
  };

  return OvertimeRequest;
};
