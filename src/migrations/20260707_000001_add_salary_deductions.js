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
    if (!(await tableExists(queryInterface, "businesses")) || !(await tableExists(queryInterface, "users"))) return;

    const payrollLinkReference = (await tableExists(queryInterface, "finance_employee_payroll_links"))
      ? { references: { model: "finance_employee_payroll_links", key: "id" }, onDelete: "CASCADE" }
      : {};
    const payrollRecordReference = (await tableExists(queryInterface, "finance_payroll_records"))
      ? { references: { model: "finance_payroll_records", key: "id" }, onDelete: "CASCADE" }
      : {};

    if (!(await tableExists(queryInterface, "finance_salary_deductions"))) {
      await queryInterface.createTable("finance_salary_deductions", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        businessId: { type: Sequelize.UUID, allowNull: false, references: { model: "businesses", key: "id" }, onDelete: "CASCADE" },
        employeeUserId: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
        payrollLinkId: { type: Sequelize.UUID, allowNull: true, ...payrollLinkReference },
        payrollRecordId: { type: Sequelize.UUID, allowNull: true, ...payrollRecordReference },
        reasonType: { type: Sequelize.STRING(80), allowNull: false },
        sourceModule: { type: Sequelize.STRING(80), allowNull: false },
        sourceTable: { type: Sequelize.STRING(120), allowNull: true },
        sourceRecordId: { type: Sequelize.UUID, allowNull: true },
        relatedDate: { type: Sequelize.DATEONLY, allowNull: true },
        amount: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
        currency: { type: Sequelize.STRING(10), allowNull: false, defaultValue: "ETB" },
        description: { type: Sequelize.TEXT, allowNull: false },
        status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "active" },
        removedByUserId: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        removedAt: { type: Sequelize.DATE, allowNull: true },
        metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        deletedAt: { type: Sequelize.DATE, allowNull: true },
      });
    }

    await addIndexSafe(queryInterface, "finance_salary_deductions", ["businessId", "employeeUserId"], "idx_salary_deductions_employee");
    await addIndexSafe(queryInterface, "finance_salary_deductions", ["businessId", "payrollLinkId"], "idx_salary_deductions_payroll_link");
    await addIndexSafe(queryInterface, "finance_salary_deductions", ["businessId", "payrollRecordId"], "idx_salary_deductions_payroll_record");
    await addIndexSafe(queryInterface, "finance_salary_deductions", ["businessId", "status"], "idx_salary_deductions_status");
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, "finance_salary_deductions")) {
      await queryInterface.dropTable("finance_salary_deductions");
    }
  },
};
