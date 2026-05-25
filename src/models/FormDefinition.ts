
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type FormDefinitionModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): FormDefinitionModel => {
  const FormDefinition = sequelize.define("FormDefinition", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    moduleKey: { type: dataTypes.STRING(120), allowNull: false },
    name: { type: dataTypes.STRING(200), allowNull: false },
    key: { type: dataTypes.STRING(120), allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: "active" }, // active, inactive, archived
    requiresApproval: { type: dataTypes.BOOLEAN, defaultValue: false },
    approvalWorkflowId: { type: dataTypes.UUID, allowNull: true },
    settings: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "form_definitions", timestamps: true, paranoid: true }) as FormDefinitionModel;

  FormDefinition.associate = (models: any) => {
    models.FormDefinition.belongsTo(models.Business, { foreignKey: "businessId" });
    if (models.ApprovalWorkflow) models.FormDefinition.belongsTo(models.ApprovalWorkflow, { foreignKey: "approvalWorkflowId" });
    models.FormDefinition.hasMany(models.FormField, { foreignKey: "formDefinitionId", as: "fields" });
    models.FormDefinition.hasMany(models.FormSubmission, { foreignKey: "formDefinitionId" });
  };
  return FormDefinition;
};