
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type FormFieldModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): FormFieldModel => {
  const FormField = sequelize.define("FormField", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    formDefinitionId: { type: dataTypes.UUID, allowNull: false },
    label: { type: dataTypes.STRING(200), allowNull: false },
    key: { type: dataTypes.STRING(120), allowNull: false },
    type: { type: dataTypes.STRING(50), allowNull: false }, // text, textarea, number, etc.
    required: { type: dataTypes.BOOLEAN, defaultValue: false },
    options: { type: dataTypes.JSONB, defaultValue: [] },
    validationRules: { type: dataTypes.JSONB, defaultValue: {} },
    orderIndex: { type: dataTypes.INTEGER, defaultValue: 0 },
    visibilityRules: { type: dataTypes.JSONB, defaultValue: {} },
    settings: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "form_fields", timestamps: true, paranoid: true }) as FormFieldModel;

  FormField.associate = (models: any) => {
    models.FormField.belongsTo(models.Business, { foreignKey: "businessId" });
    models.FormField.belongsTo(models.FormDefinition, { foreignKey: "formDefinitionId" });
  };
  return FormField;
};