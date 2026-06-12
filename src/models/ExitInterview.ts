import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ExitInterviewModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ExitInterviewModel => {
  const ExitInterview = sequelize.define("ExitInterview", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    exitProcessId: { type: dataTypes.UUID, allowNull: false },
    title: { type: dataTypes.STRING(255), allowNull: true },
    scheduledAt: { type: dataTypes.DATE, allowNull: false },
    startTime: { type: dataTypes.STRING(20), allowNull: true },
    endTime: { type: dataTypes.STRING(20), allowNull: true },
    interviewType: { type: dataTypes.STRING(50), allowNull: true },
    location: { type: dataTypes.STRING(255), allowNull: true },
    meetingUrl: { type: dataTypes.TEXT, allowNull: true },
    interviewerUserId: { type: dataTypes.UUID, allowNull: true },
    panel: { type: dataTypes.JSONB, allowNull: false, defaultValue: [] },
    status: { type: dataTypes.STRING(50), allowNull: false, defaultValue: "scheduled" },
    rating: { type: dataTypes.FLOAT, allowNull: true },
    reasonForLeaving: { type: dataTypes.TEXT, allowNull: true },
    satisfactionScore: { type: dataTypes.INTEGER, allowNull: true },
    managementFeedback: { type: dataTypes.TEXT, allowNull: true },
    workEnvironmentFeedback: { type: dataTypes.TEXT, allowNull: true },
    careerDevelopmentFeedback: { type: dataTypes.TEXT, allowNull: true },
    suggestions: { type: dataTypes.TEXT, allowNull: true },
    employeeConcerns: { type: dataTypes.TEXT, allowNull: true },
    rehireEligibility: { type: dataTypes.BOOLEAN, allowNull: true },
    handoverNotes: { type: dataTypes.TEXT, allowNull: true },
    finalRecommendation: { type: dataTypes.TEXT, allowNull: true },
    wouldRecommendCompany: { type: dataTypes.BOOLEAN, allowNull: true },
    remarks: { type: dataTypes.TEXT, allowNull: true },
    completedAt: { type: dataTypes.DATE, allowNull: true }
  }, { tableName: "hr_exit_interviews", timestamps: true, paranoid: true }) as ExitInterviewModel;

  ExitInterview.associate = (models: any) => {
    models.ExitInterview.belongsTo(models.Business, { foreignKey: "businessId" });
    models.ExitInterview.belongsTo(models.ExitProcess, { foreignKey: "exitProcessId", as: "exitProcess" });
    if (models.User) models.ExitInterview.belongsTo(models.User, { foreignKey: "interviewerUserId", as: "interviewer" });
  };

  return ExitInterview;
};
