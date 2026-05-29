import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type InterviewModel = ModelStatic<any> & {
  associate?: (models: any) => void;
};

export default (
  sequelize: Sequelize,
  dataTypes: typeof DataTypes,
): InterviewModel => {
  const Interview = sequelize.define(
    "Interview",
    {
      id: {
        type: dataTypes.UUID,
        defaultValue: dataTypes.UUIDV4,
        primaryKey: true,
      },
      businessId: { type: dataTypes.UUID, allowNull: false },
      jobApplicationId: { type: dataTypes.UUID, allowNull: false },
      scheduledByUserId: { type: dataTypes.UUID, allowNull: false },
      interviewerUserId: { type: dataTypes.UUID, allowNull: true },
      interviewAt: { type: dataTypes.DATE, allowNull: false },
      status: { type: dataTypes.STRING(50), defaultValue: "scheduled" }, // scheduled, completed, cancelled, no_show
      feedback: { type: dataTypes.JSONB, defaultValue: {} },
      duration: { type: dataTypes.INTEGER, defaultValue: 60 },
      currentSession: { type: dataTypes.INTEGER, defaultValue: 1 },
      totalSessions: { type: dataTypes.INTEGER, defaultValue: 1 },
      candidateAcceptedAt: { type: dataTypes.DATE, allowNull: true },
      candidateDeclinedAt: { type: dataTypes.DATE, allowNull: true },
      acceptanceToken: { type: dataTypes.STRING(255), allowNull: true },
      type: { type: dataTypes.STRING, defaultValue: "Face to Face" },
      venue: { type: dataTypes.STRING },
      department: { type: dataTypes.STRING },
      panel: { type: dataTypes.JSONB, defaultValue: [] }, // [{ name, role }]
      questions: { type: dataTypes.JSONB, defaultValue: [] }, // [string]
      additionalNotes: { type: dataTypes.TEXT },
      score: { type: dataTypes.FLOAT, allowNull: true },
    },
    { tableName: "hr_interviews", timestamps: true, paranoid: true },
  ) as InterviewModel;

  Interview.associate = (models: any) => {
    models.Interview.belongsTo(models.Business, { foreignKey: "businessId" });
    models.Interview.belongsTo(models.JobApplication, {
      foreignKey: "jobApplicationId",
    });
    if (models.User) {
      models.Interview.belongsTo(models.User, {
        foreignKey: "scheduledByUserId",
        as: "scheduler",
      });
      models.Interview.belongsTo(models.User, {
        foreignKey: "interviewerUserId",
        as: "interviewer",
      });
    }
    models.Interview.hasMany(models.InterviewSkill, { 
      foreignKey: "interviewId",
      as: "skills"
    });
  };
  return Interview;
};
