import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type SubscriptionModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): SubscriptionModel => {
  const Subscription = sequelize.define(
    "Subscription",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false, unique: true },
      planId: { type: dataTypes.UUID, allowNull: false },
      status: {
        type: dataTypes.ENUM("pending_payment", "trialing", "active", "past_due", "suspended", "canceled", "expired"),
        allowNull: false,
        defaultValue: "trialing",
      },
      billingCycle: { type: dataTypes.STRING(20), allowNull: false, defaultValue: "monthly" },
      startDate: { type: dataTypes.DATE, defaultValue: dataTypes.NOW },
      currentPeriodStart: { type: dataTypes.DATE, allowNull: false, defaultValue: dataTypes.NOW },
      currentPeriodEnd: { type: dataTypes.DATE, allowNull: false },
      endDate: { type: dataTypes.DATE, allowNull: true },
      trialEndsAt: { type: dataTypes.DATE, allowNull: true },
      cancelAtPeriodEnd: { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      canceledAt: { type: dataTypes.DATE, allowNull: true },
      pendingPlanId: { type: dataTypes.UUID, allowNull: true },
      pastDueSince: { type: dataTypes.DATE, allowNull: true },
      creditBalance: { type: dataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      discountPercent: { type: dataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
      retentionUntil: { type: dataTypes.DATE, allowNull: true },
      metadata: { type: dataTypes.JSONB, allowNull: false, defaultValue: {} },
    },
    { tableName: "subscriptions", timestamps: true, paranoid: true },
  ) as SubscriptionModel;

  Subscription.associate = (models: any) => {
    models.Subscription.belongsTo(models.Business, { foreignKey: "businessId" });
    if (models.Plan) models.Subscription.belongsTo(models.Plan, { foreignKey: "planId" });
    models.Subscription.hasMany(models.SubscriptionInvoice, { foreignKey: "subscriptionId" });
    models.Subscription.hasMany(models.UsageRecord, { foreignKey: "subscriptionId", as: "usageRecords" });
  };

  return Subscription;
};
