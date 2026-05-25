
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type VendorModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): VendorModel => {
  const Vendor = sequelize.define("Vendor", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    name: { type: dataTypes.STRING(255), allowNull: false },
    email: { type: dataTypes.STRING(255), allowNull: true },
    phone: { type: dataTypes.STRING(50), allowNull: true },
    serviceCategory: { type: dataTypes.STRING(100), allowNull: true },
    taxInfo: { type: dataTypes.JSONB, defaultValue: {} },
    bankInfo: { type: dataTypes.JSONB, defaultValue: {} },
    status: { type: dataTypes.STRING(50), defaultValue: "active" },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "finance_vendors", timestamps: true, paranoid: true }) as VendorModel;

  Vendor.associate = (models: any) => {
    models.Vendor.belongsTo(models.Business, { foreignKey: "businessId" });
  };
  return Vendor;
};
