
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type SubscriptionInvoiceModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): SubscriptionInvoiceModel => {
  const SubscriptionInvoice = sequelize.define("SubscriptionInvoice", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    subscriptionId: { type: dataTypes.UUID, allowNull: false },
    invoiceNumber: { type: dataTypes.STRING(100), allowNull: false },
    baseAmount: { type: dataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    seatAmount: { type: dataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    usageAmount: { type: dataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    discountAmount: { type: dataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    taxAmount: { type: dataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    totalAmount: { type: dataTypes.DECIMAL(14, 2), allowNull: false },
    currency: { type: dataTypes.STRING(10), defaultValue: "USD" },
    dueDate: { type: dataTypes.DATE, allowNull: false },
    periodStart: { type: dataTypes.DATE, allowNull: false },
    periodEnd: { type: dataTypes.DATE, allowNull: false },
    paidAt: { type: dataTypes.DATE, allowNull: true },
    status: { type: dataTypes.ENUM("draft", "issued", "paid", "failed", "void"), defaultValue: "draft" },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "subscription_invoices", timestamps: true, paranoid: true }) as SubscriptionInvoiceModel;

  SubscriptionInvoice.associate = (models: any) => {
    models.SubscriptionInvoice.belongsTo(models.Business, { foreignKey: "businessId" });
    models.SubscriptionInvoice.belongsTo(models.Subscription, { foreignKey: "subscriptionId" });
    models.SubscriptionInvoice.hasMany(models.SubscriptionPayment, { foreignKey: "invoiceId" });
  };
  return SubscriptionInvoice;
};
