
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type BusinessBrandingModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): BusinessBrandingModel => {
  const BusinessBranding = sequelize.define("BusinessBranding", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false, unique: true },
    logoFileId: { type: dataTypes.UUID, allowNull: true },
    faviconFileId: { type: dataTypes.UUID, allowNull: true },
    primaryColor: { type: dataTypes.STRING(20), defaultValue: "#000000" },
    secondaryColor: { type: dataTypes.STRING(20), defaultValue: "#ffffff" },
    accentColor: { type: dataTypes.STRING(20), defaultValue: "#3b82f6" },
    companyName: { type: dataTypes.STRING(255), allowNull: false },
    tagline: { type: dataTypes.STRING(255), allowNull: true },
    customDomain: { type: dataTypes.STRING(255), allowNull: true },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "business_branding", timestamps: true, paranoid: true }) as BusinessBrandingModel;

  BusinessBranding.associate = (models: any) => {
    models.BusinessBranding.belongsTo(models.Business, { foreignKey: "businessId" });
  };
  return BusinessBranding;
};
