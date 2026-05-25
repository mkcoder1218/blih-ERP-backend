
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ApprovalStepModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ApprovalStepModel => {
  const ApprovalStep = sequelize.define("ApprovalStep", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    workflowId: { type: dataTypes.UUID, allowNull: false },
    stepOrder: { type: dataTypes.INTEGER, allowNull: false },
    approverType: { type: dataTypes.STRING(50), allowNull: false }, // user, role, department
    approverRoleId: { type: dataTypes.UUID, allowNull: true },
    approverUserId: { type: dataTypes.UUID, allowNull: true },
    approverDepartmentId: { type: dataTypes.UUID, allowNull: true },
    actionRequired: { type: dataTypes.STRING(50), defaultValue: "any" }, // any, all
    isFinalStep: { type: dataTypes.BOOLEAN, defaultValue: false },
    settings: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "approval_steps", timestamps: true, paranoid: true }) as ApprovalStepModel;

  ApprovalStep.associate = (models: any) => {
    models.ApprovalStep.belongsTo(models.ApprovalWorkflow, { foreignKey: "workflowId", as: "workflow" });
    models.ApprovalStep.belongsTo(models.Business, { foreignKey: "businessId" });
  };
  return ApprovalStep;
};