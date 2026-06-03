import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type BudgetReallocationRequestModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): BudgetReallocationRequestModel => {
  const BudgetReallocationRequest = sequelize.define("BudgetReallocationRequest", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    sourceBudgetId: { type: dataTypes.UUID, allowNull: true },
    targetBudgetId: { type: dataTypes.UUID, allowNull: true },
    requestedByUserId: { type: dataTypes.UUID, allowNull: true },
    amount: { type: dataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    reason: { type: dataTypes.TEXT, allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: "pending" },
    reviewedByUserId: { type: dataTypes.UUID, allowNull: true },
    reviewedAt: { type: dataTypes.DATE, allowNull: true },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "finance_budget_reallocation_requests", timestamps: true, paranoid: true }) as BudgetReallocationRequestModel;

  BudgetReallocationRequest.associate = (models: any) => {
    BudgetReallocationRequest.belongsTo(models.Business, { foreignKey: "businessId" });
    BudgetReallocationRequest.belongsTo(models.Budget, { foreignKey: "sourceBudgetId", as: "sourceBudget" });
    BudgetReallocationRequest.belongsTo(models.Budget, { foreignKey: "targetBudgetId", as: "targetBudget" });
    BudgetReallocationRequest.belongsTo(models.User, { foreignKey: "requestedByUserId", as: "requester" });
    BudgetReallocationRequest.belongsTo(models.User, { foreignKey: "reviewedByUserId", as: "reviewer" });
  };

  return BudgetReallocationRequest;
};
