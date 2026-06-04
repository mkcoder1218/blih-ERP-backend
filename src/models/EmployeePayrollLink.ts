import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type EmployeePayrollLinkModel = ModelStatic<any> & { associate?: (models: any) => void };

/**
 * EmployeePayrollLink — joins an employee to a PayrollTemplate.
 *
 * When an employee is added (EmployeeRecord created) they are "pending" —
 * no link exists. Finance assigns a template + baseSalary override to link
 * them, which triggers payroll calculation stored as computed fields here.
 *
 * Computed fields are re-calculated on every link update (baseSalary change
 * or template reassignment) and served to the Salary tab.
 */
export default (sequelize: Sequelize, dataTypes: typeof DataTypes): EmployeePayrollLinkModel => {
  const EmployeePayrollLink = sequelize.define(
    "EmployeePayrollLink",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false },
      employeeUserId: { type: dataTypes.UUID, allowNull: false },
      templateId: { type: dataTypes.UUID, allowNull: false },

      // Override base salary — if null, falls back to EmployeeRecord.salaryInfo.baseSalary
      baseSalaryOverride: { type: dataTypes.FLOAT, allowNull: true, defaultValue: null },

      // ── Computed (stored at link time for fast read) ──────────────────────
      baseSalary:         { type: dataTypes.FLOAT, defaultValue: 0 },
      housingAllowance:   { type: dataTypes.FLOAT, defaultValue: 0 },
      transportAllowance: { type: dataTypes.FLOAT, defaultValue: 0 },
      mealAllowance:      { type: dataTypes.FLOAT, defaultValue: 0 },
      otherAllowance:     { type: dataTypes.FLOAT, defaultValue: 0 },
      grossPay:           { type: dataTypes.FLOAT, defaultValue: 0 },
      taxDeduction:       { type: dataTypes.FLOAT, defaultValue: 0 },
      pensionDeduction:   { type: dataTypes.FLOAT, defaultValue: 0 },
      healthDeduction:    { type: dataTypes.FLOAT, defaultValue: 0 },
      loanDeduction:      { type: dataTypes.FLOAT, defaultValue: 0 },
      otherDeduction:     { type: dataTypes.FLOAT, defaultValue: 0 },
      totalDeductions:    { type: dataTypes.FLOAT, defaultValue: 0 },
      netPay:             { type: dataTypes.FLOAT, defaultValue: 0 },

      currency: { type: dataTypes.STRING(10), defaultValue: "USD" },
      status: { type: dataTypes.STRING(50), defaultValue: "active" }, // active | paused
      linkedByUserId: { type: dataTypes.UUID, allowNull: true },
      linkedAt: { type: dataTypes.DATE, allowNull: true },
      metadata: { type: dataTypes.JSONB, defaultValue: {} },
    },
    {
      tableName: "finance_employee_payroll_links",
      timestamps: true,
      paranoid: true,
      indexes: [{ unique: true, fields: ["businessId", "employeeUserId"] }],
    }
  ) as EmployeePayrollLinkModel;

  EmployeePayrollLink.associate = (models: any) => {
    EmployeePayrollLink.belongsTo(models.Business, { foreignKey: "businessId" });
    EmployeePayrollLink.belongsTo(models.User, { foreignKey: "employeeUserId", as: "employee" });
    EmployeePayrollLink.belongsTo(models.PayrollTemplate, { foreignKey: "templateId", as: "template" });
    if (models.User) {
      EmployeePayrollLink.belongsTo(models.User, { foreignKey: "linkedByUserId", as: "linkedBy" });
    }
  };

  return EmployeePayrollLink;
};
