import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type SkillModel = ModelStatic<any> & {
  associate?: (models: any) => void;
};

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): SkillModel => {
  const Skill = sequelize.define(
    "Skill",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: true }, // null = global skill
      name: { type: dataTypes.STRING(100), allowNull: false },
      category: { type: dataTypes.STRING(50), allowNull: true }, // Frontend, Backend, Soft Skills, etc.
      status: { type: dataTypes.STRING(20), allowNull: false, defaultValue: "active" },
    },
    {
      tableName: "skills",
      timestamps: true,
      paranoid: true,
      indexes: [
        { fields: ["businessId"] },
        { fields: ["name", "businessId"], unique: true },
      ],
    }
  ) as SkillModel;

  Skill.associate = (models: any) => {
    models.Skill.belongsTo(models.Business, { foreignKey: "businessId" });
    models.Skill.hasMany(models.InterviewSkill, { foreignKey: "skillId" });
  };

  return Skill;
};