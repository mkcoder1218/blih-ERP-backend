
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type DealModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): DealModel => {
  const Deal = sequelize.define("Deal", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    leadId: { type: dataTypes.UUID, allowNull: true },
    clientId: { type: dataTypes.UUID, allowNull: true },
    ownerUserId: { type: dataTypes.UUID, allowNull: false },
    title: { type: dataTypes.STRING(255), allowNull: false },
    value: { type: dataTypes.FLOAT, defaultValue: 0 },
    currency: { type: dataTypes.STRING(10), defaultValue: "USD" },
    stage: { type: dataTypes.STRING(50), defaultValue: "discovery" },
    probability: { type: dataTypes.INTEGER, defaultValue: 0 },
    expectedCloseDate: { type: dataTypes.DATEONLY, allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: "open" }, // open, won, lost
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "crm_deals", timestamps: true, paranoid: true }) as DealModel;

  Deal.associate = (models: any) => {
    models.Deal.belongsTo(models.Business, { foreignKey: "businessId" });
    if(models.User) models.Deal.belongsTo(models.User, { foreignKey: "ownerUserId", as: "owner" });
    models.Deal.belongsTo(models.Lead, { foreignKey: "leadId" });
    models.Deal.belongsTo(models.Client, { foreignKey: "clientId" });
  };
  return Deal;
};