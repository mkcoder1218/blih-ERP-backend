
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ExpenseModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ExpenseModel => {
  const Expense = sequelize.define("Expense", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    requestedByUserId: { type: dataTypes.UUID, allowNull: true },
    departmentId: { type: dataTypes.UUID, allowNull: true },
    projectId: { type: dataTypes.UUID, allowNull: true },
    vendorId: { type: dataTypes.UUID, allowNull: true },
    category: { type: dataTypes.STRING(100), allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: true },
    amount: { type: dataTypes.FLOAT, allowNull: false },
    currency: { type: dataTypes.STRING(10), defaultValue: "USD" },
    expenseDate: { type: dataTypes.DATEONLY, allowNull: false },
    status: { type: dataTypes.STRING(50), defaultValue: "pending_approval" }, // pending_approval, approved, paid, rejected
    receiptFileId: { type: dataTypes.UUID, allowNull: true },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "finance_expenses", timestamps: true, paranoid: true }) as ExpenseModel;

  Expense.associate = (models: any) => {
    models.Expense.belongsTo(models.Business, { foreignKey: "businessId" });
    if(models.User) models.Expense.belongsTo(models.User, { foreignKey: "requestedByUserId", as: "requester" });
    if(models.Department) models.Expense.belongsTo(models.Department, { foreignKey: "departmentId" });
    if(models.Project) models.Expense.belongsTo(models.Project, { foreignKey: "projectId" });
    if(models.FileAsset) models.Expense.belongsTo(models.FileAsset, { as: 'receipt', foreignKey: "receiptFileId" });
  };
  return Expense;
};
