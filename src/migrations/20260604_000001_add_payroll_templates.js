"use strict";

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

async function addIndexSafe(queryInterface, tableName, fields, name, options = {}) {
  const indexes = await queryInterface.showIndex(tableName);
  if (!indexes.some((idx) => idx.name === name)) {
    await queryInterface.addIndex(tableName, fields, { ...options, name });
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "businesses")) || !(await tableExists(queryInterface, "users"))) {
      return;
    }

    if (!(await tableExists(queryInterface, "finance_payroll_templates"))) {
      await queryInterface.createTable("finance_payroll_templates", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        businessId: { type: Sequelize.UUID, allowNull: false, references: { model: "businesses", key: "id" }, onDelete: "CASCADE" },
        name: { type: Sequelize.STRING(255), allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: true },
        housingAllowancePct: { type: Sequelize.FLOAT, allowNull: true },
        transportAllowancePct: { type: Sequelize.FLOAT, allowNull: true },
        mealAllowancePct: { type: Sequelize.FLOAT, allowNull: true },
        otherAllowancePct: { type: Sequelize.FLOAT, allowNull: true },
        taxPct: { type: Sequelize.FLOAT, allowNull: true },
        pensionPct: { type: Sequelize.FLOAT, allowNull: true },
        healthPct: { type: Sequelize.FLOAT, allowNull: true },
        loanRepaymentFlat: { type: Sequelize.FLOAT, allowNull: true },
        otherDeductionFlat: { type: Sequelize.FLOAT, allowNull: true },
        currency: { type: Sequelize.STRING(10), defaultValue: "USD" },
        isDefault: { type: Sequelize.BOOLEAN, defaultValue: false },
        status: { type: Sequelize.STRING(50), defaultValue: "active" },
        createdByUserId: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        deletedAt: { type: Sequelize.DATE, allowNull: true },
      });
    }

    if (!(await tableExists(queryInterface, "finance_employee_payroll_links"))) {
      await queryInterface.createTable("finance_employee_payroll_links", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        businessId: { type: Sequelize.UUID, allowNull: false, references: { model: "businesses", key: "id" }, onDelete: "CASCADE" },
        employeeUserId: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
        templateId: { type: Sequelize.UUID, allowNull: false, references: { model: "finance_payroll_templates", key: "id" }, onDelete: "RESTRICT" },
        baseSalaryOverride: { type: Sequelize.FLOAT, allowNull: true },
        baseSalary: { type: Sequelize.FLOAT, defaultValue: 0 },
        housingAllowance: { type: Sequelize.FLOAT, defaultValue: 0 },
        transportAllowance: { type: Sequelize.FLOAT, defaultValue: 0 },
        mealAllowance: { type: Sequelize.FLOAT, defaultValue: 0 },
        otherAllowance: { type: Sequelize.FLOAT, defaultValue: 0 },
        grossPay: { type: Sequelize.FLOAT, defaultValue: 0 },
        taxDeduction: { type: Sequelize.FLOAT, defaultValue: 0 },
        pensionDeduction: { type: Sequelize.FLOAT, defaultValue: 0 },
        healthDeduction: { type: Sequelize.FLOAT, defaultValue: 0 },
        loanDeduction: { type: Sequelize.FLOAT, defaultValue: 0 },
        otherDeduction: { type: Sequelize.FLOAT, defaultValue: 0 },
        totalDeductions: { type: Sequelize.FLOAT, defaultValue: 0 },
        netPay: { type: Sequelize.FLOAT, defaultValue: 0 },
        currency: { type: Sequelize.STRING(10), defaultValue: "USD" },
        status: { type: Sequelize.STRING(50), defaultValue: "active" },
        linkedByUserId: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        linkedAt: { type: Sequelize.DATE, allowNull: true },
        metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        deletedAt: { type: Sequelize.DATE, allowNull: true },
      });
    }

    await addIndexSafe(queryInterface, "finance_employee_payroll_links", ["businessId", "employeeUserId"], "uq_employee_payroll_link", { unique: true });
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, "finance_employee_payroll_links")) await queryInterface.dropTable("finance_employee_payroll_links");
    if (await tableExists(queryInterface, "finance_payroll_templates")) await queryInterface.dropTable("finance_payroll_templates");
  },
};
