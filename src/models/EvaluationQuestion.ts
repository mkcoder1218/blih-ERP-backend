import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type EvaluationQuestionModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): EvaluationQuestionModel => {
  const EvaluationQuestion = sequelize.define("EvaluationQuestion", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    sectionId: { type: dataTypes.UUID, allowNull: false },
    type: { type: dataTypes.STRING(50), allowNull: false }, // TEXT, TEXTAREA, NUMBER, RATING, SINGLE_SELECT, MULTI_SELECT, BOOLEAN, DATE, KPI_REFERENCE, OKR_REFERENCE
    label: { type: dataTypes.STRING(500), allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: true },
    isRequired: { type: dataTypes.BOOLEAN, defaultValue: false },
    options: { type: dataTypes.JSONB, allowNull: true },
    validationRules: { type: dataTypes.JSONB, allowNull: true },
    scoreWeight: { type: dataTypes.FLOAT, defaultValue: 1.0 },
    orderIndex: { type: dataTypes.INTEGER, defaultValue: 0 }
  }, { tableName: "eval_questions", timestamps: true }) as EvaluationQuestionModel;

  EvaluationQuestion.associate = (models: any) => {
    models.EvaluationQuestion.belongsTo(models.Business, { foreignKey: "businessId" });
    models.EvaluationQuestion.belongsTo(models.EvaluationSection, { foreignKey: "sectionId", as: "section" });
  };
  return EvaluationQuestion;
};
