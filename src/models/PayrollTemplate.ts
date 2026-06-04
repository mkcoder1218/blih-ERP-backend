import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type PayrollTemplateModel = ModelStatic<any> & { associate?: (models: any) => void };

/**
 * PayrollTemplate — reusable payroll calculation formula created by Finance.
 *
 * All percentage fields are optional (null = not applied).
 * Allowances ADD to base salary; deductions SUBTRACT from gross.
 *
 * Calculation order:
 *   allowances  = base * (housing% + transport% + meal% + other%)
 *   grossPay    = base + allowances
 *   deductions  = grossPay * (tax% + pension% + health%) + loanFlat + otherFlat
 *   netPay      = grossPay - deductions
 */
export default (sequelize: Sequelize, dataTypes: typeof DataTypes): PayrollTemplateModel => {
  const PayrollTemplate = sequelize.define(
    "PayrollTemplate",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false },
      name: { type: dataTypes.STRING(255), allowNull: false },
      description: { type: dataTypes.TEXT, allowNull: true },

      // ── Allowances (% of base salary) ─────────────────────────────────────
      housingAllowancePct:   { type: dataTypes.FLOAT, allowNull: true, defaultValue: null },
      transportAllowancePct: { type: dataTypes.FLOAT, allowNull: true, defaultValue: null },
      mealAllowancePct:      { type: dataTypes.FLOAT, allowNull: true, defaultValue: null },
      otherAllowancePct:     { type: dataTypes.FLOAT, allowNull: true, defaultValue: null },

      // ── Deductions (% of gross pay) ────────────────────────────────────────
      taxPct:     { type: dataTypes.FLOAT, allowNull: true, defaultValue: null },
      pensionPct: { type: dataTypes.FLOAT, allowNull: true, defaultValue: null },
      healthPct:  { type: dataTypes.FLOAT, allowNull: true, defaultValue: null },

      // ── Flat deductions (absolute amounts) ────────────────────────────────
      loanRepaymentFlat: { type: dataTypes.FLOAT, allowNull: true, defaultValue: null },
      otherDeductionFlat: { type: dataTypes.FLOAT, allowNull: true, defaultValue: null },

      currency: { type: dataTypes.STRING(10), defaultValue: "USD" },
      isDefault: { type: dataTypes.BOOLEAN, defaultValue: false },
      status: { type: dataTypes.STRING(50), defaultValue: "active" },
      createdByUserId: { type: dataTypes.UUID, allowNull: true },
      metadata: { type: dataTypes.JSONB, defaultValue: {} },
    },
    {
      tableName: "finance_payroll_templates",
      timestamps: true,
      paranoid: true,
    }
  ) as PayrollTemplateModel;

  PayrollTemplate.associate = (models: any) => {
    PayrollTemplate.belongsTo(models.Business, { foreignKey: "businessId" });
    if (models.User) {
      PayrollTemplate.belongsTo(models.User, { foreignKey: "createdByUserId", as: "creator" });
    }
    PayrollTemplate.hasMany(models.EmployeePayrollLink, { foreignKey: "templateId", as: "links" });
  };

  return PayrollTemplate;
};
