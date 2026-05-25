
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ModuleTemplateFormModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ModuleTemplateFormModel => {
  const ModuleTemplateForm = sequelize.define("ModuleTemplateForm", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    moduleTemplateId: { type: dataTypes.UUID, allowNull: false },
    formKey: { type: dataTypes.STRING(120), allowNull: false },
    formName: { type: dataTypes.STRING(200), allowNull: false },
    formSchema: { type: dataTypes.JSONB, defaultValue: {} },
    defaultFields: { type: dataTypes.JSONB, defaultValue: [] },
    settings: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "module_template_forms", timestamps: true }) as ModuleTemplateFormModel;

  ModuleTemplateForm.associate = (models: any) => {
    models.ModuleTemplateForm.belongsTo(models.ModuleTemplate, { foreignKey: "moduleTemplateId" });
  };
  return ModuleTemplateForm;
};