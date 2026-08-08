import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type EvaluationSectionModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): EvaluationSectionModel => {
  const EvaluationSection = sequelize.define("EvaluationSection", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    templateId: { type: dataTypes.UUID, allowNull: false },
    title: { type: dataTypes.STRING(255), allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: true },
    orderIndex: { type: dataTypes.INTEGER, defaultValue: 0 }
  }, { tableName: "eval_sections", timestamps: true }) as EvaluationSectionModel;

  EvaluationSection.associate = (models: any) => {
    models.EvaluationSection.belongsTo(models.Business, { foreignKey: "businessId" });
    models.EvaluationSection.belongsTo(models.EvaluationTemplate, { foreignKey: "templateId", as: "template" });
    models.EvaluationSection.hasMany(models.EvaluationQuestion, { foreignKey: "sectionId", as: "questions" });
  };
  return EvaluationSection;
};
