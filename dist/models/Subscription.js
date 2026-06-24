"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const Subscription = sequelize.define("Subscription", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false, unique: true },
        planId: { type: dataTypes.UUID, allowNull: false },
        status: { type: dataTypes.ENUM("trialing", "active", "past_due", "canceled", "expired"), defaultValue: "trialing" },
        billingCycle: { type: dataTypes.STRING(20), defaultValue: "monthly" }, // monthly, yearly, lifetime
        startDate: { type: dataTypes.DATE, defaultValue: dataTypes.NOW },
        currentPeriodStart: { type: dataTypes.DATE, allowNull: false, defaultValue: dataTypes.NOW },
        currentPeriodEnd: { type: dataTypes.DATE, allowNull: false },
        endDate: { type: dataTypes.DATE, allowNull: true },
        trialEndsAt: { type: dataTypes.DATE, allowNull: true },
        cancelAtPeriodEnd: { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        canceledAt: { type: dataTypes.DATE, allowNull: true },
        pendingPlanId: { type: dataTypes.UUID, allowNull: true },
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "subscriptions", timestamps: true, paranoid: true });
    Subscription.associate = (models) => {
        models.Subscription.belongsTo(models.Business, { foreignKey: "businessId" });
        if (models.Plan)
            models.Subscription.belongsTo(models.Plan, { foreignKey: "planId" });
        models.Subscription.hasMany(models.SubscriptionInvoice, { foreignKey: "subscriptionId" });
        models.Subscription.hasMany(models.UsageRecord, { foreignKey: "subscriptionId", as: "usageRecords" });
    };
    return Subscription;
};
