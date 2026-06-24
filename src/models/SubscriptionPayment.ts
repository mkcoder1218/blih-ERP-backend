
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type SubscriptionPaymentModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): SubscriptionPaymentModel => {
  const SubscriptionPayment = sequelize.define("SubscriptionPayment", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    invoiceId: { type: dataTypes.UUID, allowNull: false },
    amount: { type: dataTypes.DECIMAL(14, 2), allowNull: false },
    currency: { type: dataTypes.STRING(10), defaultValue: "USD" },
    provider: { type: dataTypes.STRING(50), allowNull: false },
    providerReference: { type: dataTypes.STRING(255), allowNull: true },
    paidAt: { type: dataTypes.DATE, allowNull: true },
    status: { type: dataTypes.ENUM("pending", "paid", "failed", "refunded"), defaultValue: "pending" },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "subscription_payments", timestamps: true, paranoid: true }) as SubscriptionPaymentModel;

  SubscriptionPayment.associate = (models: any) => {
    models.SubscriptionPayment.belongsTo(models.Business, { foreignKey: "businessId" });
    models.SubscriptionPayment.belongsTo(models.SubscriptionInvoice, { foreignKey: "invoiceId" });
  };
  return SubscriptionPayment;
};
