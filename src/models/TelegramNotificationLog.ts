import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type TelegramNotificationLogModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): TelegramNotificationLogModel => {
  const TelegramNotificationLog = sequelize.define(
    "TelegramNotificationLog",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false },
      botType: { type: dataTypes.STRING(40), allowNull: false },
      recipientChatId: { type: dataTypes.STRING(120), allowNull: true },
      eventType: { type: dataTypes.STRING(80), allowNull: false },
      status: { type: dataTypes.STRING(30), allowNull: false },
      payload: { type: dataTypes.JSONB, allowNull: true },
      errorMessage: { type: dataTypes.TEXT, allowNull: true },
      sentAt: { type: dataTypes.DATE, allowNull: true }
    },
    {
      tableName: "telegram_notification_logs",
      timestamps: true
    }
  ) as TelegramNotificationLogModel;

  TelegramNotificationLog.associate = (models: any) => {
    TelegramNotificationLog.belongsTo(models.Business, { foreignKey: "businessId" });
  };

  return TelegramNotificationLog;
};
