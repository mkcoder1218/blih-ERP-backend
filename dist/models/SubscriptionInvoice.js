"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const SubscriptionInvoice = sequelize.define("SubscriptionInvoice", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        subscriptionId: { type: dataTypes.UUID, allowNull: false },
        invoiceNumber: { type: dataTypes.STRING(100), allowNull: false },
        amount: { type: dataTypes.FLOAT, allowNull: false },
        currency: { type: dataTypes.STRING(10), defaultValue: "USD" },
        dueDate: { type: dataTypes.DATE, allowNull: false },
        paidAt: { type: dataTypes.DATE, allowNull: true },
        status: { type: dataTypes.STRING(50), defaultValue: "draft" }, // draft, issued, paid, overdue, cancelled
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "subscription_invoices", timestamps: true, paranoid: true });
    SubscriptionInvoice.associate = (models) => {
        models.SubscriptionInvoice.belongsTo(models.Business, { foreignKey: "businessId" });
        models.SubscriptionInvoice.belongsTo(models.Subscription, { foreignKey: "subscriptionId" });
        models.SubscriptionInvoice.hasMany(models.SubscriptionPayment, { foreignKey: "subscriptionInvoiceId" });
    };
    return SubscriptionInvoice;
};
