
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ApprovalWorkflowModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ApprovalWorkflowModel => {
  const ApprovalWorkflow = sequelize.define("ApprovalWorkflow", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    moduleKey: { type: dataTypes.STRING(120), allowNull: false },
    entityType: { type: dataTypes.STRING(120), allowNull: false },
    name: { type: dataTypes.STRING(200), allowNull: false },
    key: { type: dataTypes.STRING(120), allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: "active" }, // active, inactive
    settings: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "approval_workflows", timestamps: true, paranoid: true }) as ApprovalWorkflowModel;

  ApprovalWorkflow.associate = (models: any) => {
    models.ApprovalWorkflow.belongsTo(models.Business, { foreignKey: "businessId" });
    models.ApprovalWorkflow.hasMany(models.ApprovalStep, { foreignKey: "workflowId", as: "steps" });
    models.ApprovalWorkflow.hasMany(models.ApprovalRequest, { foreignKey: "workflowId" });
  };
  return ApprovalWorkflow;
};