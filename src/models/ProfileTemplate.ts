import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ProfileTemplateModel = ModelStatic<any> & {
  associate?: (models: any) => void;
};

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ProfileTemplateModel => {
  const ProfileTemplate = sequelize.define(
    "ProfileTemplate",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false },
      name: { type: dataTypes.STRING(160), allowNull: false },
      description: { type: dataTypes.STRING(500), allowNull: true },
      fields: { type: dataTypes.JSONB, allowNull: false, defaultValue: [] }
    },
    {
      tableName: "profile_templates",
      timestamps: true,
      paranoid: true,
      indexes: [{ fields: ["businessId"] }]
    }
  ) as ProfileTemplateModel;

  ProfileTemplate.associate = (models: any) => {
    models.ProfileTemplate.belongsTo(models.Business, { foreignKey: "businessId" });
    models.ProfileTemplate.hasMany(models.ProfileDraft, { foreignKey: "templateId", as: "drafts" });
  };

  return ProfileTemplate;
};

