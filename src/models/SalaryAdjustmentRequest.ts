import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type SalaryAdjustmentRequestModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): SalaryAdjustmentRequestModel => {
  const SalaryAdjustmentRequest = sequelize.define("SalaryAdjustmentRequest", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    employeeUserId: { type: dataTypes.UUID, allowNull: false },
    requestedByUserId: { type: dataTypes.UUID, allowNull: true },
    departmentId: { type: dataTypes.UUID, allowNull: true },
    currentSalary: { type: dataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    requestedSalary: { type: dataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    reason: { type: dataTypes.TEXT, allowNull: true },
    priority: { type: dataTypes.STRING(50), allowNull: false, defaultValue: "medium" },
    status: { type: dataTypes.STRING(50), allowNull: false, defaultValue: "pending" },
    reviewedByUserId: { type: dataTypes.UUID, allowNull: true },
    reviewedAt: { type: dataTypes.DATE, allowNull: true },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "finance_salary_adjustment_requests", timestamps: true, paranoid: true }) as SalaryAdjustmentRequestModel;

  SalaryAdjustmentRequest.associate = (models: any) => {
    SalaryAdjustmentRequest.belongsTo(models.Business, { foreignKey: "businessId" });
    SalaryAdjustmentRequest.belongsTo(models.User, { foreignKey: "employeeUserId", as: "employee" });
    SalaryAdjustmentRequest.belongsTo(models.User, { foreignKey: "requestedByUserId", as: "requester" });
    SalaryAdjustmentRequest.belongsTo(models.User, { foreignKey: "reviewedByUserId", as: "reviewer" });
    if (models.Department) SalaryAdjustmentRequest.belongsTo(models.Department, { foreignKey: "departmentId", as: "department" });
  };

  return SalaryAdjustmentRequest;
};
