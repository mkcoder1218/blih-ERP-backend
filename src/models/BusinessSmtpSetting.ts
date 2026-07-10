import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type BusinessSmtpSettingModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): BusinessSmtpSettingModel => {
  const BusinessSmtpSetting = sequelize.define("BusinessSmtpSetting", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    providerId: { type: dataTypes.UUID, allowNull: false },
    senderName: { type: dataTypes.STRING(160), allowNull: false },
    senderEmailEncrypted: { type: dataTypes.TEXT, allowNull: false },
    smtpUsernameEncrypted: { type: dataTypes.TEXT, allowNull: false },
    smtpPasswordEncrypted: { type: dataTypes.TEXT, allowNull: false },
    isActive: { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    lastTestedAt: { type: dataTypes.DATE, allowNull: true },
    lastTestStatus: { type: dataTypes.STRING(30), allowNull: true },
  }, { tableName: "business_smtp_settings", timestamps: true, paranoid: true }) as BusinessSmtpSettingModel;

  BusinessSmtpSetting.associate = (models: any) => {
    models.BusinessSmtpSetting.belongsTo(models.Business, { foreignKey: "businessId" });
    models.BusinessSmtpSetting.belongsTo(models.SmtpProvider, { foreignKey: "providerId" });
  };

  return BusinessSmtpSetting;
};
