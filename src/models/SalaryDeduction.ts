import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type SalaryDeductionModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): SalaryDeductionModel => {
  const SalaryDeduction = sequelize.define(
    "SalaryDeduction",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false },
      employeeUserId: { type: dataTypes.UUID, allowNull: false },
      payrollLinkId: { type: dataTypes.UUID, allowNull: true },
      payrollRecordId: { type: dataTypes.UUID, allowNull: true },
      reasonType: { type: dataTypes.STRING(80), allowNull: false },
      sourceModule: { type: dataTypes.STRING(80), allowNull: false },
      sourceTable: { type: dataTypes.STRING(120), allowNull: true },
      sourceRecordId: { type: dataTypes.UUID, allowNull: true },
      relatedDate: { type: dataTypes.DATEONLY, allowNull: true },
      amount: { type: dataTypes.FLOAT, allowNull: false, defaultValue: 0 },
      currency: { type: dataTypes.STRING(10), allowNull: false, defaultValue: "ETB" },
      description: { type: dataTypes.TEXT, allowNull: false },
      status: { type: dataTypes.STRING(40), allowNull: false, defaultValue: "active" },
      removedByUserId: { type: dataTypes.UUID, allowNull: true },
      removedAt: { type: dataTypes.DATE, allowNull: true },
      metadata: { type: dataTypes.JSONB, allowNull: false, defaultValue: {} },
    },
    {
      tableName: "finance_salary_deductions",
      timestamps: true,
      paranoid: true,
      indexes: [
        { fields: ["businessId", "employeeUserId"] },
        { fields: ["businessId", "payrollLinkId"] },
        { fields: ["businessId", "payrollRecordId"] },
        { fields: ["businessId", "status"] },
      ],
    }
  ) as SalaryDeductionModel;

  SalaryDeduction.associate = (models: any) => {
    SalaryDeduction.belongsTo(models.Business, { foreignKey: "businessId" });
    SalaryDeduction.belongsTo(models.User, { foreignKey: "employeeUserId", as: "employee" });
    if (models.EmployeePayrollLink) SalaryDeduction.belongsTo(models.EmployeePayrollLink, { foreignKey: "payrollLinkId", as: "payrollLink" });
    if (models.PayrollRecord) SalaryDeduction.belongsTo(models.PayrollRecord, { foreignKey: "payrollRecordId", as: "payrollRecord" });
    if (models.User) SalaryDeduction.belongsTo(models.User, { foreignKey: "removedByUserId", as: "removedBy" });
  };

  return SalaryDeduction;
};
