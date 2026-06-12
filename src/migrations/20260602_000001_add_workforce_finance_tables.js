"use strict";

const common = (queryInterface, Sequelize) => ({
  id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
  businessId: { type: Sequelize.UUID, allowNull: false, references: { model: "businesses", key: "id" }, onDelete: "CASCADE" },
  metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
  createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  deletedAt: { type: Sequelize.DATE, allowNull: true }
});

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "businesses")) || !(await tableExists(queryInterface, "users"))) {
      return;
    }

    if (!(await tableExists(queryInterface, "finance_budgets"))) {
      await queryInterface.createTable("finance_budgets", {
        ...common(queryInterface, Sequelize),
        departmentId: { type: Sequelize.UUID, allowNull: true, references: { model: "departments", key: "id" }, onDelete: "SET NULL" },
        name: { type: Sequelize.STRING(255), allowNull: false },
        periodType: { type: Sequelize.STRING(50), defaultValue: "annual" },
        periodStart: { type: Sequelize.DATEONLY, allowNull: true },
        periodEnd: { type: Sequelize.DATEONLY, allowNull: true },
        allocatedAmount: { type: Sequelize.FLOAT, defaultValue: 0 },
        usedAmount: { type: Sequelize.FLOAT, defaultValue: 0 },
        currency: { type: Sequelize.STRING(10), defaultValue: "USD" },
        status: { type: Sequelize.STRING(50), defaultValue: "active" }
      });
    }

    if (!(await tableExists(queryInterface, "finance_salary_adjustment_requests"))) {
      await queryInterface.createTable("finance_salary_adjustment_requests", {
      ...common(queryInterface, Sequelize),
      employeeUserId: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
      requestedByUserId: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
      departmentId: { type: Sequelize.UUID, allowNull: true, references: { model: "departments", key: "id" }, onDelete: "SET NULL" },
      currentSalary: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
      requestedSalary: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
      reason: { type: Sequelize.TEXT, allowNull: true },
      priority: { type: Sequelize.STRING(50), allowNull: false, defaultValue: "medium" },
      status: { type: Sequelize.STRING(50), allowNull: false, defaultValue: "pending" },
      reviewedByUserId: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
      reviewedAt: { type: Sequelize.DATE, allowNull: true }
      });
    }

    if (!(await tableExists(queryInterface, "finance_payroll_records"))) {
      await queryInterface.createTable("finance_payroll_records", {
      ...common(queryInterface, Sequelize),
      employeeUserId: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
      departmentId: { type: Sequelize.UUID, allowNull: true, references: { model: "departments", key: "id" }, onDelete: "SET NULL" },
      periodStart: { type: Sequelize.DATEONLY, allowNull: false },
      periodEnd: { type: Sequelize.DATEONLY, allowNull: false },
      payDate: { type: Sequelize.DATEONLY, allowNull: true },
      baseSalary: { type: Sequelize.FLOAT, defaultValue: 0 },
      pension: { type: Sequelize.FLOAT, defaultValue: 0 },
      grossPay: { type: Sequelize.FLOAT, defaultValue: 0 },
      tax: { type: Sequelize.FLOAT, defaultValue: 0 },
      netPay: { type: Sequelize.FLOAT, defaultValue: 0 },
      overtime: { type: Sequelize.FLOAT, defaultValue: 0 },
      bonus: { type: Sequelize.FLOAT, defaultValue: 0 },
      commission: { type: Sequelize.FLOAT, defaultValue: 0 },
      currency: { type: Sequelize.STRING(10), defaultValue: "USD" },
      status: { type: Sequelize.STRING(50), defaultValue: "scheduled" }
      });
    }

    if (!(await tableExists(queryInterface, "finance_benefits"))) {
      await queryInterface.createTable("finance_benefits", {
      ...common(queryInterface, Sequelize),
      departmentId: { type: Sequelize.UUID, allowNull: true, references: { model: "departments", key: "id" }, onDelete: "SET NULL" },
      name: { type: Sequelize.STRING(160), allowNull: false },
      category: { type: Sequelize.STRING(80), allowNull: false },
      monthlyBudget: { type: Sequelize.FLOAT, defaultValue: 0 },
      annualBudget: { type: Sequelize.FLOAT, defaultValue: 0 },
      employerSharePercent: { type: Sequelize.FLOAT, allowNull: true },
      employeeSharePercent: { type: Sequelize.FLOAT, allowNull: true },
      perEmployeeMax: { type: Sequelize.FLOAT, allowNull: true },
      currency: { type: Sequelize.STRING(10), defaultValue: "USD" },
      status: { type: Sequelize.STRING(50), defaultValue: "active" }
      });
    }

    if (!(await tableExists(queryInterface, "finance_benefit_enrollments"))) {
      await queryInterface.createTable("finance_benefit_enrollments", {
      ...common(queryInterface, Sequelize),
      benefitId: { type: Sequelize.UUID, allowNull: false, references: { model: "finance_benefits", key: "id" }, onDelete: "CASCADE" },
      employeeUserId: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
      departmentId: { type: Sequelize.UUID, allowNull: true, references: { model: "departments", key: "id" }, onDelete: "SET NULL" },
      value: { type: Sequelize.FLOAT, defaultValue: 0 },
      status: { type: Sequelize.STRING(50), defaultValue: "active" },
      enrolledAt: { type: Sequelize.DATEONLY, allowNull: true }
      });
    }

    if (!(await tableExists(queryInterface, "finance_budget_reallocation_requests"))) {
      await queryInterface.createTable("finance_budget_reallocation_requests", {
      ...common(queryInterface, Sequelize),
      sourceBudgetId: { type: Sequelize.UUID, allowNull: true, references: { model: "finance_budgets", key: "id" }, onDelete: "SET NULL" },
      targetBudgetId: { type: Sequelize.UUID, allowNull: true, references: { model: "finance_budgets", key: "id" }, onDelete: "SET NULL" },
      requestedByUserId: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
      amount: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
      reason: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.STRING(50), defaultValue: "pending" },
      reviewedByUserId: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
      reviewedAt: { type: Sequelize.DATE, allowNull: true }
      });
    }
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, "finance_budget_reallocation_requests")) await queryInterface.dropTable("finance_budget_reallocation_requests");
    if (await tableExists(queryInterface, "finance_benefit_enrollments")) await queryInterface.dropTable("finance_benefit_enrollments");
    if (await tableExists(queryInterface, "finance_benefits")) await queryInterface.dropTable("finance_benefits");
    if (await tableExists(queryInterface, "finance_payroll_records")) await queryInterface.dropTable("finance_payroll_records");
    if (await tableExists(queryInterface, "finance_salary_adjustment_requests")) await queryInterface.dropTable("finance_salary_adjustment_requests");
    if (await tableExists(queryInterface, "finance_budgets")) await queryInterface.dropTable("finance_budgets");
  }
};
