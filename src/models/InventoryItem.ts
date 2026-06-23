import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type InventoryItemModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): InventoryItemModel => {
  const InventoryItem = sequelize.define(
    "InventoryItem",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false },
      name: { type: dataTypes.STRING(255), allowNull: false },
      category: { type: dataTypes.STRING(120), allowNull: false, defaultValue: "equipment" },
      assetTag: { type: dataTypes.STRING(120), allowNull: true },
      serialNumber: { type: dataTypes.STRING(160), allowNull: true },
      condition: { type: dataTypes.STRING(80), allowNull: false, defaultValue: "New" },
      status: { type: dataTypes.STRING(40), allowNull: false, defaultValue: "AVAILABLE" },
      assignedToUserId: { type: dataTypes.UUID, allowNull: true },
      reservedForOnboardingId: { type: dataTypes.UUID, allowNull: true },
      notes: { type: dataTypes.TEXT, allowNull: true },
      metadata: { type: dataTypes.JSONB, allowNull: false, defaultValue: {} },
    },
    {
      tableName: "inventory_items",
      timestamps: true,
      paranoid: true,
      indexes: [
        { fields: ["businessId"] },
        { fields: ["status"] },
        { fields: ["reservedForOnboardingId"] },
        { fields: ["assignedToUserId"] },
      ],
    }
  ) as InventoryItemModel;

  InventoryItem.associate = (models: any) => {
    InventoryItem.belongsTo(models.Business, { foreignKey: "businessId" });
    if (models.User) InventoryItem.belongsTo(models.User, { foreignKey: "assignedToUserId", as: "assignedTo" });
    if (models.CandidateOnboarding) InventoryItem.belongsTo(models.CandidateOnboarding, { foreignKey: "reservedForOnboardingId", as: "reservedOnboarding" });
  };

  return InventoryItem;
};
