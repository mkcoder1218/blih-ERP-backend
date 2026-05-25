"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const SubscriptionPayment = sequelize.define("SubscriptionPayment", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        subscriptionInvoiceId: { type: dataTypes.UUID, allowNull: false },
        amount: { type: dataTypes.FLOAT, allowNull: false },
        currency: { type: dataTypes.STRING(10), defaultValue: "USD" },
        paymentMethod: { type: dataTypes.STRING(50), allowNull: false }, // credit_card, bank_transfer, stripe...
        reference: { type: dataTypes.STRING(255), allowNull: true },
        paidAt: { type: dataTypes.DATE, defaultValue: dataTypes.NOW },
        status: { type: dataTypes.STRING(50), defaultValue: "pending" }, // pending, confirmed, failed, refunded
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "subscription_payments", timestamps: true, paranoid: true });
    SubscriptionPayment.associate = (models) => {
        models.SubscriptionPayment.belongsTo(models.Business, { foreignKey: "businessId" });
        models.SubscriptionPayment.belongsTo(models.SubscriptionInvoice, { foreignKey: "subscriptionInvoiceId" });
    };
    return SubscriptionPayment;
};
