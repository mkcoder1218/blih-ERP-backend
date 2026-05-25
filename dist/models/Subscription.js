"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const Subscription = sequelize.define("Subscription", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false, unique: true },
        planId: { type: dataTypes.UUID, allowNull: false },
        status: { type: dataTypes.STRING(50), defaultValue: "trial" }, // trial, active, past_due, suspended, cancelled, expired
        billingCycle: { type: dataTypes.STRING(20), defaultValue: "monthly" }, // monthly, yearly, lifetime
        startDate: { type: dataTypes.DATE, defaultValue: dataTypes.NOW },
        endDate: { type: dataTypes.DATE, allowNull: true },
        trialEndsAt: { type: dataTypes.DATE, allowNull: true },
        cancelledAt: { type: dataTypes.DATE, allowNull: true },
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "subscriptions", timestamps: true, paranoid: true });
    Subscription.associate = (models) => {
        models.Subscription.belongsTo(models.Business, { foreignKey: "businessId" });
        if (models.Plan)
            models.Subscription.belongsTo(models.Plan, { foreignKey: "planId" });
        models.Subscription.hasMany(models.SubscriptionInvoice, { foreignKey: "subscriptionId" });
    };
    return Subscription;
};
