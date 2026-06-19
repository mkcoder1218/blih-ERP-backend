"use strict";

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

async function addColumnSafe(queryInterface, Sequelize, tableName, columnName, definition) {
  const table = await queryInterface.describeTable(tableName);
  if (!table[columnName]) await queryInterface.addColumn(tableName, columnName, definition);
}

async function removeColumnSafe(queryInterface, tableName, columnName) {
  const table = await queryInterface.describeTable(tableName);
  if (table[columnName]) await queryInterface.removeColumn(tableName, columnName);
}

async function addIndexSafe(queryInterface, tableName, fields, name) {
  const indexes = await queryInterface.showIndex(tableName);
  if (!indexes.some((idx) => idx.name === name)) await queryInterface.addIndex(tableName, fields, { name });
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "hr_employee_records"))) return;

    await addColumnSafe(queryInterface, Sequelize, "hr_employee_records", "employmentCategory", {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
    await addColumnSafe(queryInterface, Sequelize, "hr_employee_records", "assignedStartTime", {
      type: Sequelize.STRING(5),
      allowNull: false,
      defaultValue: "09:00",
    });
    await addColumnSafe(queryInterface, Sequelize, "hr_employee_records", "scheduledWorkDays", {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [1, 2, 3, 4, 5],
    });

    await addIndexSafe(queryInterface, "hr_employee_records", ["businessId", "employmentStatus"], "idx_hr_employee_records_business_status");
    await addIndexSafe(queryInterface, "hr_employee_records", ["businessId", "departmentId"], "idx_hr_employee_records_business_department");
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface, "hr_employee_records"))) return;
    await removeColumnSafe(queryInterface, "hr_employee_records", "scheduledWorkDays");
    await removeColumnSafe(queryInterface, "hr_employee_records", "assignedStartTime");
    await removeColumnSafe(queryInterface, "hr_employee_records", "employmentCategory");
  },
};
