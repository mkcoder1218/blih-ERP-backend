"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // ── 1. PayrollTemplate ──────────────────────────────────────────────────
    await queryInterface.createTable("finance_payroll_templates", {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      businessId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: "businesses", key: "id" }, onDelete: "CASCADE"
      },
      name: { type: Sequelize.STRING(255), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },

      // Allowances (% of base)
      housingAllowancePct:   { type: Sequelize.FLOAT, allowNull: true },
      transportAllowancePct: { type: Sequelize.FLOAT, allowNull: true },
      mealAllowancePct:      { type: Sequelize.FLOAT, allowNull: true },
      otherAllowancePct:     { type: Sequelize.FLOAT, allowNull: true },

      // Deductions (% of gross)
      taxPct:     { type: Sequelize.FLOAT, allowNull: true },
      pensionPct: { type: Sequelize.FLOAT, allowNull: true },
      healthPct:  { type: Sequelize.FLOAT, allowNull: true },

      // Flat deductions
      loanRepaymentFlat:  { type: Sequelize.FLOAT, allowNull: true },
      otherDeductionFlat: { type: Sequelize.FLOAT, allowNull: true },

      currency:    { type: Sequelize.STRING(10), defaultValue: "USD" },
      isDefault:   { type: Sequelize.BOOLEAN, defaultValue: false },
      status:      { type: Sequelize.STRING(50), defaultValue: "active" },
      createdByUserId: {
        type: Sequelize.UUID, allowNull: true,
        references: { model: "users", key: "id" }, onDelete: "SET NULL"
      },
      metadata:  { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      deletedAt: { type: Sequelize.DATE, allowNull: true },
    });

    // ── 2. EmployeePayrollLink ──────────────────────────────────────────────
    await queryInterface.createTable("finance_employee_payroll_links", {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      businessId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: "businesses", key: "id" }, onDelete: "CASCADE"
      },
      employeeUserId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: "users", key: "id" }, onDelete: "CASCADE"
      },
      templateId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: "finance_payroll_templates", key: "id" }, onDelete: "RESTRICT"
      },
      baseSalaryOverride: { type: Sequelize.FLOAT, allowNull: true },

      // Computed
      baseSalary:         { type: Sequelize.FLOAT, defaultValue: 0 },
      housingAllowance:   { type: Sequelize.FLOAT, defaultValue: 0 },
      transportAllowance: { type: Sequelize.FLOAT, defaultValue: 0 },
      mealAllowance:      { type: Sequelize.FLOAT, defaultValue: 0 },
      otherAllowance:     { type: Sequelize.FLOAT, defaultValue: 0 },
      grossPay:           { type: Sequelize.FLOAT, defaultValue: 0 },
      taxDeduction:       { type: Sequelize.FLOAT, defaultValue: 0 },
      pensionDeduction:   { type: Sequelize.FLOAT, defaultValue: 0 },
      healthDeduction:    { type: Sequelize.FLOAT, defaultValue: 0 },
      loanDeduction:      { type: Sequelize.FLOAT, defaultValue: 0 },
      otherDeduction:     { type: Sequelize.FLOAT, defaultValue: 0 },
      totalDeductions:    { type: Sequelize.FLOAT, defaultValue: 0 },
      netPay:             { type: Sequelize.FLOAT, defaultValue: 0 },

      currency: { type: Sequelize.STRING(10), defaultValue: "USD" },
      status:   { type: Sequelize.STRING(50), defaultValue: "active" },
      linkedByUserId: {
        type: Sequelize.UUID, allowNull: true,
        references: { model: "users", key: "id" }, onDelete: "SET NULL"
      },
      linkedAt:  { type: Sequelize.DATE, allowNull: true },
      metadata:  { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      deletedAt: { type: Sequelize.DATE, allowNull: true },
    });

    await queryInterface.addIndex("finance_employee_payroll_links", ["businessId", "employeeUserId"], { unique: true, name: "uq_employee_payroll_link" });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("finance_employee_payroll_links");
    await queryInterface.dropTable("finance_payroll_templates");
  },
};
