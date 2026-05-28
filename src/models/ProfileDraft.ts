import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ProfileDraftModel = ModelStatic<any> & {
  associate?: (models: any) => void;
};

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ProfileDraftModel => {
  const ProfileDraft = sequelize.define(
    "ProfileDraft",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false },
      templateId: { type: dataTypes.UUID, allowNull: false },
      status: { type: dataTypes.STRING(40), allowNull: false, defaultValue: "draft" },
      data: { type: dataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdById: { type: dataTypes.UUID, allowNull: false }
    },
    {
      tableName: "profile_drafts",
      timestamps: true,
      paranoid: true,
      indexes: [{ fields: ["businessId"] }, { fields: ["templateId"] }, { fields: ["createdById"] }]
    }
  ) as ProfileDraftModel;

  ProfileDraft.associate = (models: any) => {
    models.ProfileDraft.belongsTo(models.Business, { foreignKey: "businessId" });
    models.ProfileDraft.belongsTo(models.ProfileTemplate, { foreignKey: "templateId", as: "template" });
    models.ProfileDraft.belongsTo(models.User, { foreignKey: "createdById", as: "createdBy" });
  };

  return ProfileDraft;
};

