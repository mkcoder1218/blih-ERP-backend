
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type NotificationPreferenceModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): NotificationPreferenceModel => {
  const NotificationPreference = sequelize.define("NotificationPreference", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    userId: { type: dataTypes.UUID, allowNull: false },
    channel: { type: dataTypes.STRING(50), allowNull: false }, // in_app, email, sms
    moduleKey: { type: dataTypes.STRING(120), allowNull: true },
    type: { type: dataTypes.STRING(120), allowNull: true },
    isEnabled: { type: dataTypes.BOOLEAN, defaultValue: true },
    settings: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "notification_preferences", timestamps: true }) as NotificationPreferenceModel;

  NotificationPreference.associate = (models: any) => {
    models.NotificationPreference.belongsTo(models.Business, { foreignKey: "businessId" });
    models.NotificationPreference.belongsTo(models.User, { foreignKey: "userId" });
  };
  return NotificationPreference;
};