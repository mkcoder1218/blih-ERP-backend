import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type InterviewerNoteModel = ModelStatic<any> & {
  associate?: (models: any) => void;
};

export default (
  sequelize: Sequelize,
  dataTypes: typeof DataTypes,
): InterviewerNoteModel => {
  const InterviewerNote = sequelize.define(
    "InterviewerNote",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId:   { type: dataTypes.UUID, allowNull: false },
      interviewId:  { type: dataTypes.UUID, allowNull: false },
      interviewerId:{ type: dataTypes.UUID, allowNull: false }, // the staff member
      // Per-interviewer data
      questions:    { type: dataTypes.JSONB, defaultValue: [] },   // [{ question: string }]
      notes:        { type: dataTypes.TEXT,  allowNull: true },
      skillRatings: { type: dataTypes.JSONB, defaultValue: [] },   // [{ skillId, actualRating }]
      candidateScore: { type: dataTypes.FLOAT, allowNull: true },  // 0-100 or 1-5
    },
    {
      tableName: "interview_notes",
      timestamps: true,
      paranoid: true,
      indexes: [
        { fields: ["interviewId"] },
        { fields: ["interviewerId"] },
        // one note record per interviewer per interview
        { fields: ["interviewId", "interviewerId"], unique: true },
      ],
    },
  ) as InterviewerNoteModel;

  InterviewerNote.associate = (models: any) => {
    models.InterviewerNote.belongsTo(models.Business,  { foreignKey: "businessId" });
    models.InterviewerNote.belongsTo(models.Interview, { foreignKey: "interviewId" });
    models.InterviewerNote.belongsTo(models.User, { foreignKey: "interviewerId", as: "interviewer" });
  };

  return InterviewerNote;
};
