import type { DataTypes, ModelStatic, Sequelize } from "sequelize";
export default (sequelize: Sequelize, d: typeof DataTypes): ModelStatic<any> & { associate?: (m: any) => void } => {
  const UsageRecord = sequelize.define("UsageRecord", {
    id: { type: d.UUID, defaultValue: d.UUIDV4, primaryKey: true },
    businessId: { type: d.UUID, allowNull: false },
    subscriptionId: { type: d.UUID, allowNull: false },
    featureId: { type: d.UUID, allowNull: false },
    quantity: { type: d.DECIMAL(14, 2), allowNull: false },
    unitPrice: { type: d.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    totalPrice: { type: d.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    usageDate: { type: d.DATE, allowNull: false, defaultValue: d.NOW },
    billingPeriod: { type: d.STRING(20), allowNull: false },
    metadata: { type: d.JSONB, allowNull: false, defaultValue: {} }
  }, { tableName: "usage_records", timestamps: true, indexes: [{ fields: ["subscriptionId", "usageDate"] }] }) as any;
  UsageRecord.associate = (m: any) => {
    UsageRecord.belongsTo(m.Business, { foreignKey: "businessId" });
    UsageRecord.belongsTo(m.Subscription, { foreignKey: "subscriptionId" });
    UsageRecord.belongsTo(m.Feature, { foreignKey: "featureId", as: "feature" });
  };
  return UsageRecord;
};
