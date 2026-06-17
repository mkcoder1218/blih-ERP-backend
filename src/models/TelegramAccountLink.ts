import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type TelegramAccountLinkModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): TelegramAccountLinkModel => {
  const TelegramAccountLink = sequelize.define(
    "TelegramAccountLink",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false },
      userId: { type: dataTypes.UUID, allowNull: false },
      telegramUserId: { type: dataTypes.STRING(80), allowNull: false },
      telegramChatId: { type: dataTypes.STRING(120), allowNull: false },
      telegramUsername: { type: dataTypes.STRING(160), allowNull: true },
      pendingAction: { type: dataTypes.JSONB, allowNull: true },
      isActive: { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      linkedAt: { type: dataTypes.DATE, allowNull: false, defaultValue: dataTypes.NOW },
      unlinkedAt: { type: dataTypes.DATE, allowNull: true }
    },
    {
      tableName: "telegram_account_links",
      timestamps: true,
      indexes: [
        { unique: true, fields: ["businessId", "userId"] },
        { unique: true, fields: ["businessId", "telegramUserId"] }
      ]
    }
  ) as TelegramAccountLinkModel;

  TelegramAccountLink.associate = (models: any) => {
    TelegramAccountLink.belongsTo(models.Business, { foreignKey: "businessId" });
    TelegramAccountLink.belongsTo(models.User, { foreignKey: "userId", as: "user" });
  };

  return TelegramAccountLink;
};
