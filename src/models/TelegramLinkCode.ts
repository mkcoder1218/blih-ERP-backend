import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type TelegramLinkCodeModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): TelegramLinkCodeModel => {
  const TelegramLinkCode = sequelize.define(
    "TelegramLinkCode",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false },
      userId: { type: dataTypes.UUID, allowNull: false },
      codeHash: { type: dataTypes.STRING(128), allowNull: false, unique: true },
      expiresAt: { type: dataTypes.DATE, allowNull: false },
      usedAt: { type: dataTypes.DATE, allowNull: true }
    },
    {
      tableName: "telegram_link_codes",
      timestamps: true
    }
  ) as TelegramLinkCodeModel;

  TelegramLinkCode.associate = (models: any) => {
    TelegramLinkCode.belongsTo(models.Business, { foreignKey: "businessId" });
    TelegramLinkCode.belongsTo(models.User, { foreignKey: "userId", as: "user" });
  };

  return TelegramLinkCode;
};
