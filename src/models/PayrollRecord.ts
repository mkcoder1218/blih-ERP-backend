import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type PayrollRecordModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): PayrollRecordModel => {
  const PayrollRecord = sequelize.define("PayrollRecord", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    employeeUserId: { type: dataTypes.UUID, allowNull: false },
    departmentId: { type: dataTypes.UUID, allowNull: true },
    periodStart: { type: dataTypes.DATEONLY, allowNull: false },
    periodEnd: { type: dataTypes.DATEONLY, allowNull: false },
    payDate: { type: dataTypes.DATEONLY, allowNull: true },
    baseSalary: { type: dataTypes.FLOAT, defaultValue: 0 },
    pension: { type: dataTypes.FLOAT, defaultValue: 0 },
    grossPay: { type: dataTypes.FLOAT, defaultValue: 0 },
    tax: { type: dataTypes.FLOAT, defaultValue: 0 },
    netPay: { type: dataTypes.FLOAT, defaultValue: 0 },
    overtime: { type: dataTypes.FLOAT, defaultValue: 0 },
    bonus: { type: dataTypes.FLOAT, defaultValue: 0 },
    commission: { type: dataTypes.FLOAT, defaultValue: 0 },
    currency: { type: dataTypes.STRING(10), defaultValue: "USD" },
    status: { type: dataTypes.STRING(50), defaultValue: "scheduled" },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "finance_payroll_records", timestamps: true, paranoid: true }) as PayrollRecordModel;

  PayrollRecord.associate = (models: any) => {
    PayrollRecord.belongsTo(models.Business, { foreignKey: "businessId" });
    PayrollRecord.belongsTo(models.User, { foreignKey: "employeeUserId", as: "employee" });
    if (models.Department) PayrollRecord.belongsTo(models.Department, { foreignKey: "departmentId", as: "department" });
    if (models.SalaryDeduction) PayrollRecord.hasMany(models.SalaryDeduction, { foreignKey: "payrollRecordId", as: "deductions" });
  };

  return PayrollRecord;
};
