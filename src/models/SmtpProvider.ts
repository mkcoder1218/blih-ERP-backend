import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type SmtpProviderModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): SmtpProviderModel => {
  const SmtpProvider = sequelize.define("SmtpProvider", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    name: { type: dataTypes.STRING(120), allowNull: false },
    smtpHost: { type: dataTypes.STRING(255), allowNull: false },
    smtpPort: { type: dataTypes.INTEGER, allowNull: false, defaultValue: 587 },
    encryptionType: { type: dataTypes.STRING(40), allowNull: false, defaultValue: "STARTTLS" },
    secureConnection: { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    isActive: { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    appPasswordRequired: { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    instructions: { type: dataTypes.TEXT, allowNull: true },
    createdBy: { type: dataTypes.UUID, allowNull: true },
    updatedBy: { type: dataTypes.UUID, allowNull: true },
  }, { tableName: "smtp_providers", timestamps: true, paranoid: true }) as SmtpProviderModel;

  return SmtpProvider;
};
