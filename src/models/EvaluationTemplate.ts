import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type EvaluationTemplateModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): EvaluationTemplateModel => {
  const EvaluationTemplate = sequelize.define("EvaluationTemplate", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    title: { type: dataTypes.STRING(255), allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: true },
    category: { type: dataTypes.STRING(100), allowNull: false }, // PERFORMANCE_REVIEW, KPI_ASSESSMENT, OKR_CHECK_IN, COMPETENCY_SURVEY, CUSTOM
    targetAudience: { type: dataTypes.STRING(255), allowNull: false },
    frequency: { type: dataTypes.STRING(50), allowNull: false }, // ONE_TIME, MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL
    status: { type: dataTypes.STRING(50), defaultValue: "DRAFT" }, // DRAFT, ACTIVE, ARCHIVED
    createdById: { type: dataTypes.UUID, allowNull: false }
  }, { tableName: "eval_templates", timestamps: true, paranoid: true }) as EvaluationTemplateModel;

  EvaluationTemplate.associate = (models: any) => {
    models.EvaluationTemplate.belongsTo(models.Business, { foreignKey: "businessId" });
    models.EvaluationTemplate.belongsTo(models.User, { foreignKey: "createdById", as: "creator" });
    models.EvaluationTemplate.hasMany(models.EvaluationSection, { foreignKey: "templateId", as: "sections" });
    models.EvaluationTemplate.hasMany(models.EvaluationAssignment, { foreignKey: "templateId", as: "assignments" });
  };
  return EvaluationTemplate;
};
