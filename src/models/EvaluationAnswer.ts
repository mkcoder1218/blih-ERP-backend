import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type EvaluationAnswerModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): EvaluationAnswerModel => {
  const EvaluationAnswer = sequelize.define("EvaluationAnswer", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    responseId: { type: dataTypes.UUID, allowNull: false },
    questionId: { type: dataTypes.UUID, allowNull: false },
    textValue: { type: dataTypes.TEXT, allowNull: true },
    numberValue: { type: dataTypes.FLOAT, allowNull: true },
    dateValue: { type: dataTypes.DATEONLY, allowNull: true },
    optionValues: { type: dataTypes.JSONB, allowNull: true },
    kpiValue: { type: dataTypes.FLOAT, allowNull: true },
    okrValue: { type: dataTypes.FLOAT, allowNull: true },
    referencedKpiId: { type: dataTypes.UUID, allowNull: true },
    referencedObjectiveId: { type: dataTypes.UUID, allowNull: true },
    referencedKeyResultId: { type: dataTypes.UUID, allowNull: true },
    capturedValue: { type: dataTypes.FLOAT, allowNull: true }
  }, { tableName: "eval_answers", timestamps: true }) as EvaluationAnswerModel;

  EvaluationAnswer.associate = (models: any) => {
    models.EvaluationAnswer.belongsTo(models.Business, { foreignKey: "businessId" });
    models.EvaluationAnswer.belongsTo(models.EvaluationResponse, { foreignKey: "responseId", as: "response" });
    models.EvaluationAnswer.belongsTo(models.EvaluationQuestion, { foreignKey: "questionId", as: "question" });
    models.EvaluationAnswer.belongsTo(models.Kpi, { foreignKey: "referencedKpiId", as: "referencedKpi", constraints: false });
    models.EvaluationAnswer.belongsTo(models.OkrObjective, { foreignKey: "referencedObjectiveId", as: "referencedObjective", constraints: false });
    models.EvaluationAnswer.belongsTo(models.OkrKeyResult, { foreignKey: "referencedKeyResultId", as: "referencedKeyResult", constraints: false });
  };
  return EvaluationAnswer;
};
