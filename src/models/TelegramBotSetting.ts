import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type TelegramBotSettingModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): TelegramBotSettingModel => {
  const TelegramBotSetting = sequelize.define(
    "TelegramBotSetting",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false },
      botType: { type: dataTypes.STRING(40), allowNull: false },
      botToken: { type: dataTypes.STRING(220), allowNull: true },
      chatId: { type: dataTypes.STRING(120), allowNull: true },
      sendTime: { type: dataTypes.STRING(5), allowNull: true },
      timezone: { type: dataTypes.STRING(80), allowNull: false, defaultValue: "UTC" },
      enabled: { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      updateOffset: { type: dataTypes.INTEGER, allowNull: true },
      lastSentForDate: { type: dataTypes.STRING(10), allowNull: true },
      lastSentAt: { type: dataTypes.DATE, allowNull: true }
    },
    {
      tableName: "telegram_bot_settings",
      timestamps: true,
      indexes: [{ unique: true, fields: ["businessId", "botType"] }]
    }
  ) as TelegramBotSettingModel;

  TelegramBotSetting.associate = (models: any) => {
    TelegramBotSetting.belongsTo(models.Business, { foreignKey: "businessId" });
  };

  return TelegramBotSetting;
};
