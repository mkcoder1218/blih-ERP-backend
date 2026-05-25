"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const Payment = sequelize.define("Payment", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        invoiceId: { type: dataTypes.UUID, allowNull: true },
        clientId: { type: dataTypes.UUID, allowNull: true },
        amount: { type: dataTypes.FLOAT, allowNull: false },
        currency: { type: dataTypes.STRING(10), defaultValue: "USD" },
        paymentDate: { type: dataTypes.DATEONLY, allowNull: true },
        method: { type: dataTypes.STRING(50) }, // bank_transfer, credit_card, cash, etc
        reference: { type: dataTypes.STRING(255) },
        status: { type: dataTypes.STRING(50), defaultValue: "completed" },
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "finance_payments", timestamps: true, paranoid: true });
    Payment.associate = (models) => {
        models.Payment.belongsTo(models.Business, { foreignKey: "businessId" });
        models.Payment.belongsTo(models.Invoice, { foreignKey: "invoiceId" });
        if (models.Client)
            models.Payment.belongsTo(models.Client, { foreignKey: "clientId" });
    };
    return Payment;
};
