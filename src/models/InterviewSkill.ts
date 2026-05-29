import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type InterviewSkillModel = ModelStatic<any> & {
  associate?: (models: any) => void;
};

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): InterviewSkillModel => {
  const InterviewSkill = sequelize.define(
    "InterviewSkill",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false },
      interviewId: { type: dataTypes.UUID, allowNull: false },
      skillId: { type: dataTypes.UUID, allowNull: false },
      requiredRating: { type: dataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
      actualRating: { type: dataTypes.INTEGER, allowNull: true, validate: { min: 1, max: 5 } },
    },
    {
      tableName: "interview_skills",
      timestamps: true,
      paranoid: true,
      indexes: [
        { fields: ["interviewId"] },
        { fields: ["skillId"] },
        { fields: ["businessId"] },
      ],
    }
  ) as InterviewSkillModel;

  InterviewSkill.associate = (models: any) => {
    models.InterviewSkill.belongsTo(models.Business, { foreignKey: "businessId" });
    models.InterviewSkill.belongsTo(models.Interview, { foreignKey: "interviewId" });
    models.InterviewSkill.belongsTo(models.Skill, { foreignKey: "skillId" });
  };

  return InterviewSkill;
};