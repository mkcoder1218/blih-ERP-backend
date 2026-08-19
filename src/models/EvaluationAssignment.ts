import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type EvaluationAssignmentModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): EvaluationAssignmentModel => {
  const EvaluationAssignment = sequelize.define("EvaluationAssignment", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    templateId: { type: dataTypes.UUID, allowNull: false },
    targetType: { type: dataTypes.STRING(50), allowNull: false }, // EMPLOYEE, DEPARTMENT, ROLE
    targetId: { type: dataTypes.UUID, allowNull: true },
    evaluatorType: { type: dataTypes.STRING(50), allowNull: false }, // SELF, MANAGER, PEER, HR, DEPARTMENT_HEAD, CUSTOM
    evaluatorUserId: { type: dataTypes.UUID, allowNull: false },
    participantUserId: { type: dataTypes.UUID, allowNull: false },
    dueDate: { type: dataTypes.DATEONLY, allowNull: false },
    status: { type: dataTypes.STRING(50), defaultValue: "PENDING" }, // PENDING, IN_PROGRESS, SUBMITTED, OVERDUE, CANCELLED
    templateSnapshot: { type: dataTypes.JSONB, allowNull: false },
    completedAt: { type: dataTypes.DATE, allowNull: true }
  }, { tableName: "eval_assignments", timestamps: true }) as EvaluationAssignmentModel;

  EvaluationAssignment.associate = (models: any) => {
    models.EvaluationAssignment.belongsTo(models.Business, { foreignKey: "businessId" });
    models.EvaluationAssignment.belongsTo(models.EvaluationTemplate, { foreignKey: "templateId", as: "template" });
    models.EvaluationAssignment.belongsTo(models.User, { foreignKey: "evaluatorUserId", as: "evaluator" });
    models.EvaluationAssignment.belongsTo(models.User, { foreignKey: "participantUserId", as: "participant" });
    models.EvaluationAssignment.hasOne(models.EvaluationResponse, { foreignKey: "assignmentId", as: "response" });
  };
  return EvaluationAssignment;
};
