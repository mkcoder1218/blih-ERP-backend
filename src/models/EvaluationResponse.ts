import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type EvaluationResponseModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): EvaluationResponseModel => {
  const EvaluationResponse = sequelize.define("EvaluationResponse", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    assignmentId: { type: dataTypes.UUID, allowNull: false },
    templateId: { type: dataTypes.UUID, allowNull: false },
    submitterUserId: { type: dataTypes.UUID, allowNull: false },
    status: { type: dataTypes.STRING(50), defaultValue: "DRAFT" }, // SUBMITTED, DRAFT
    score: { type: dataTypes.FLOAT, allowNull: true },
    submittedAt: { type: dataTypes.DATE, allowNull: true }
  }, { tableName: "eval_responses", timestamps: true }) as EvaluationResponseModel;

  EvaluationResponse.associate = (models: any) => {
    models.EvaluationResponse.belongsTo(models.Business, { foreignKey: "businessId" });
    models.EvaluationResponse.belongsTo(models.EvaluationAssignment, { foreignKey: "assignmentId", as: "assignment" });
    models.EvaluationResponse.belongsTo(models.EvaluationTemplate, { foreignKey: "templateId", as: "template" });
    models.EvaluationResponse.belongsTo(models.User, { foreignKey: "submitterUserId", as: "submitter" });
    models.EvaluationResponse.hasMany(models.EvaluationAnswer, { foreignKey: "responseId", as: "answers" });
  };
  return EvaluationResponse;
};
