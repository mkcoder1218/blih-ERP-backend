import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type UserExemptionModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): UserExemptionModel => {
  const UserExemption = sequelize.define(
    "UserExemption",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false },
      userId: { type: dataTypes.UUID, allowNull: false },
      reason: { type: dataTypes.TEXT, allowNull: false },
      excludeFromPayroll: { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      status: { type: dataTypes.ENUM("PENDING", "APPROVED", "REJECTED"), allowNull: false, defaultValue: "PENDING" },
      requestedBy: { type: dataTypes.UUID, allowNull: false },
      approvedBy: { type: dataTypes.UUID, allowNull: true },
      rejectedBy: { type: dataTypes.UUID, allowNull: true },
      approvedAt: { type: dataTypes.DATE, allowNull: true },
      rejectedAt: { type: dataTypes.DATE, allowNull: true },
    },
    {
      tableName: "user_exemptions",
      timestamps: true,
      paranoid: true,
      indexes: [
        { fields: ["businessId", "userId", "status"] },
        { fields: ["businessId", "status"] },
      ],
    }
  ) as UserExemptionModel;

  UserExemption.associate = (models: any) => {
    UserExemption.belongsTo(models.Business, { foreignKey: "businessId" });
    UserExemption.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    UserExemption.belongsTo(models.User, { foreignKey: "requestedBy", as: "requester" });
    UserExemption.belongsTo(models.User, { foreignKey: "approvedBy", as: "approver" });
    UserExemption.belongsTo(models.User, { foreignKey: "rejectedBy", as: "rejecter" });
  };

  return UserExemption;
};
