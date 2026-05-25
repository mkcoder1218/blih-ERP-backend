"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const Invoice = sequelize.define("Invoice", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        clientId: { type: dataTypes.UUID, allowNull: true },
        projectId: { type: dataTypes.UUID, allowNull: true },
        dealId: { type: dataTypes.UUID, allowNull: true },
        invoiceNumber: { type: dataTypes.STRING(100), allowNull: false },
        issueDate: { type: dataTypes.DATEONLY, allowNull: true },
        dueDate: { type: dataTypes.DATEONLY, allowNull: true },
        currency: { type: dataTypes.STRING(10), defaultValue: "USD" },
        subtotal: { type: dataTypes.FLOAT, defaultValue: 0 },
        taxTotal: { type: dataTypes.FLOAT, defaultValue: 0 },
        discountTotal: { type: dataTypes.FLOAT, defaultValue: 0 },
        grandTotal: { type: dataTypes.FLOAT, defaultValue: 0 },
        status: { type: dataTypes.STRING(50), defaultValue: "draft" }, // draft, issued, partial, paid, overdue, cancelled
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "finance_invoices", timestamps: true, paranoid: true });
    Invoice.associate = (models) => {
        models.Invoice.belongsTo(models.Business, { foreignKey: "businessId" });
        if (models.Client)
            models.Invoice.belongsTo(models.Client, { foreignKey: "clientId" });
        if (models.Project)
            models.Invoice.belongsTo(models.Project, { foreignKey: "projectId" });
        if (models.Deal)
            models.Invoice.belongsTo(models.Deal, { foreignKey: "dealId" });
        models.Invoice.hasMany(models.InvoiceItem, { foreignKey: "invoiceId" });
    };
    return Invoice;
};
