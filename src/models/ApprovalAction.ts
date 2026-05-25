
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ApprovalActionModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ApprovalActionModel => {
  const ApprovalAction = sequelize.define("ApprovalAction", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    approvalRequestId: { type: dataTypes.UUID, allowNull: false },
    approvalStepId: { type: dataTypes.UUID, allowNull: false },
    actedByUserId: { type: dataTypes.UUID, allowNull: false },
    action: { type: dataTypes.STRING(50), allowNull: false }, // approve, reject, return, cancel
    comment: { type: dataTypes.TEXT, allowNull: true },
    actionData: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "approval_actions", timestamps: true, updatedAt: false }) as ApprovalActionModel;

  ApprovalAction.associate = (models: any) => {
    models.ApprovalAction.belongsTo(models.Business, { foreignKey: "businessId" });
    models.ApprovalAction.belongsTo(models.ApprovalRequest, { foreignKey: "approvalRequestId" });
    models.ApprovalAction.belongsTo(models.ApprovalStep, { foreignKey: "approvalStepId" });
  };
  return ApprovalAction;
};