import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type SpecialRequestModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): SpecialRequestModel => {
  const SpecialRequest = sequelize.define(
    "SpecialRequest",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false },
      requestedBy: { type: dataTypes.UUID, allowNull: false },
      requestedDate: { type: dataTypes.DATEONLY, allowNull: false },
      requestType: { type: dataTypes.STRING(40), allowNull: false, defaultValue: "Special Request" },
      lunchUsageType: { type: dataTypes.STRING(20), allowNull: false, defaultValue: "PARTIAL" },
      requestedMinutes: { type: dataTypes.INTEGER, allowNull: false },
      reason: { type: dataTypes.TEXT, allowNull: false },
      status: { type: dataTypes.STRING(20), allowNull: false, defaultValue: "pending" },
      submittedAt: { type: dataTypes.DATE, allowNull: false, defaultValue: dataTypes.NOW },
      approvedBy: { type: dataTypes.UUID, allowNull: true },
      approvedAt: { type: dataTypes.DATE, allowNull: true },
      rejectedBy: { type: dataTypes.UUID, allowNull: true },
      rejectedAt: { type: dataTypes.DATE, allowNull: true },
      rejectedReason: { type: dataTypes.TEXT, allowNull: true },
    },
    {
      tableName: "special_requests",
      timestamps: true,
      paranoid: true,
    }
  ) as SpecialRequestModel;

  SpecialRequest.associate = (models: any) => {
    models.SpecialRequest.belongsTo(models.Business, { foreignKey: "businessId" });
    models.SpecialRequest.belongsTo(models.User, { foreignKey: "requestedBy", as: "requester" });
    models.SpecialRequest.belongsTo(models.User, { foreignKey: "approvedBy", as: "approver" });
    models.SpecialRequest.belongsTo(models.User, { foreignKey: "rejectedBy", as: "rejecter" });
  };

  return SpecialRequest;
};
