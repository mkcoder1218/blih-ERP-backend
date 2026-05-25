
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type BusinessSettingModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): BusinessSettingModel => {
  const BusinessSetting = sequelize.define("BusinessSetting", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    key: { type: dataTypes.STRING(100), allowNull: false },
    value: { type: dataTypes.JSONB, allowNull: false },
    category: { type: dataTypes.STRING(50), defaultValue: "general" },
    isPublic: { type: dataTypes.BOOLEAN, defaultValue: false }
  }, { tableName: "business_settings", timestamps: true, paranoid: true }) as BusinessSettingModel;

  BusinessSetting.associate = (models: any) => {
    models.BusinessSetting.belongsTo(models.Business, { foreignKey: "businessId" });
  };
  return BusinessSetting;
};
