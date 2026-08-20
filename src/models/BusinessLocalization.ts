
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type BusinessLocalizationModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): BusinessLocalizationModel => {
  const BusinessLocalization = sequelize.define("BusinessLocalization", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false, unique: true },
    timezone: { type: dataTypes.STRING(100), defaultValue: "UTC" },
    currency: { type: dataTypes.STRING(10), defaultValue: "USD" },
    language: { type: dataTypes.STRING(20), defaultValue: "en" },
    dateFormat: { type: dataTypes.STRING(20), defaultValue: "YYYY-MM-DD" },
    timeFormat: { type: dataTypes.STRING(20), defaultValue: "24h" },
    fiscalYearStartMonth: { type: dataTypes.INTEGER, defaultValue: 1 },
    taxSettings: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "business_localizations", timestamps: true, paranoid: true }) as BusinessLocalizationModel;

  BusinessLocalization.associate = (models: any) => {
    models.BusinessLocalization.belongsTo(models.Business, { foreignKey: "businessId" });
  };
  return BusinessLocalization;
};
