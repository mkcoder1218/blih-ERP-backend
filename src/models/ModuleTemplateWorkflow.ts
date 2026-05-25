
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ModuleTemplateWorkflowModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ModuleTemplateWorkflowModel => {
  const ModuleTemplateWorkflow = sequelize.define("ModuleTemplateWorkflow", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    moduleTemplateId: { type: dataTypes.UUID, allowNull: false },
    workflowKey: { type: dataTypes.STRING(120), allowNull: false },
    workflowName: { type: dataTypes.STRING(200), allowNull: false },
    workflowSchema: { type: dataTypes.JSONB, defaultValue: {} },
    defaultSteps: { type: dataTypes.JSONB, defaultValue: [] },
    settings: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "module_template_workflows", timestamps: true }) as ModuleTemplateWorkflowModel;

  ModuleTemplateWorkflow.associate = (models: any) => {
    models.ModuleTemplateWorkflow.belongsTo(models.ModuleTemplate, { foreignKey: "moduleTemplateId" });
  };
  return ModuleTemplateWorkflow;
};