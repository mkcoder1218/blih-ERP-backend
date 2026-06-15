import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type TrustedDeviceModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): TrustedDeviceModel => {
  const TrustedDevice = sequelize.define(
    "TrustedDevice",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false },
      userId: { type: dataTypes.UUID, allowNull: false },
      deviceKey: { type: dataTypes.STRING(120), allowNull: false },
      deviceSignature: { type: dataTypes.STRING(255), allowNull: true },
      label: { type: dataTypes.STRING(160), allowNull: false },
      userAgent: { type: dataTypes.TEXT, allowNull: true },
      status: { type: dataTypes.STRING(40), allowNull: false, defaultValue: "approved" },
      lastSeenAt: { type: dataTypes.DATE, allowNull: true },
      approvedAt: { type: dataTypes.DATE, allowNull: true },
      approvedByUserId: { type: dataTypes.UUID, allowNull: true },
      rejectedAt: { type: dataTypes.DATE, allowNull: true },
      rejectedByUserId: { type: dataTypes.UUID, allowNull: true },
    },
    {
      tableName: "trusted_devices",
      timestamps: true,
      paranoid: true,
      indexes: [
        { unique: true, fields: ["businessId", "userId", "deviceKey"] },
        { fields: ["businessId", "userId", "deviceSignature"] },
        { fields: ["businessId", "status"] },
      ],
    }
  ) as TrustedDeviceModel;

  TrustedDevice.associate = (models: any) => {
    models.TrustedDevice.belongsTo(models.Business, { foreignKey: "businessId" });
    models.TrustedDevice.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    models.TrustedDevice.belongsTo(models.User, { foreignKey: "approvedByUserId", as: "approvedBy" });
    models.TrustedDevice.belongsTo(models.User, { foreignKey: "rejectedByUserId", as: "rejectedBy" });
  };

  return TrustedDevice;
};
