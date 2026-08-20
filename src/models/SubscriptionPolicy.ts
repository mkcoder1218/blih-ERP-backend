import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type SubscriptionPolicyModel = ModelStatic<any> & {
  associate?: (models: any) => void;
};

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): SubscriptionPolicyModel => {
  const SubscriptionPolicy = sequelize.define(
    "SubscriptionPolicy",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      scopeKey: { type: dataTypes.STRING(180), allowNull: false, unique: true },
      scopeType: { type: dataTypes.ENUM("platform", "plan", "business"), allowNull: false },
      planId: { type: dataTypes.UUID, allowNull: true },
      businessId: { type: dataTypes.UUID, allowNull: true },
      gracePeriodDays: { type: dataTypes.INTEGER, allowNull: true },
      graceAccessMode: {
        type: dataTypes.ENUM("full", "read_only", "business_admin_only", "billing_only", "locked"),
        allowNull: true,
      },
      expiredAccessMode: {
        type: dataTypes.ENUM("full", "read_only", "business_admin_only", "billing_only", "locked"),
        allowNull: true,
      },
      retentionDays: { type: dataTypes.INTEGER, allowNull: true },
      downgradePolicy: {
        type: dataTypes.ENUM("block", "allow_with_warning", "restrict_new"),
        allowNull: true,
      },
      autoRenew: { type: dataTypes.BOOLEAN, allowNull: true },
      metadata: { type: dataTypes.JSONB, allowNull: false, defaultValue: {} },
    },
    {
      tableName: "subscription_policies",
      timestamps: true,
      indexes: [
        { fields: ["scopeType"] },
        { fields: ["planId"] },
        { fields: ["businessId"] },
      ],
    },
  ) as SubscriptionPolicyModel;

  SubscriptionPolicy.associate = (models: any) => {
    SubscriptionPolicy.belongsTo(models.Plan, { foreignKey: "planId", as: "plan" });
    SubscriptionPolicy.belongsTo(models.Business, { foreignKey: "businessId", as: "business" });
  };

  return SubscriptionPolicy;
};
