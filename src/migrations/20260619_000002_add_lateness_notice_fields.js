"use strict";

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

async function addColumnSafe(queryInterface, tableName, columnName, definition) {
  const table = await queryInterface.describeTable(tableName);
  if (!table[columnName]) await queryInterface.addColumn(tableName, columnName, definition);
}

async function removeColumnSafe(queryInterface, tableName, columnName) {
  const table = await queryInterface.describeTable(tableName);
  if (table[columnName]) await queryInterface.removeColumn(tableName, columnName);
}

async function addIndexSafe(queryInterface, tableName, fields, name, options = {}) {
  const indexes = await queryInterface.showIndex(tableName);
  if (!indexes.some((idx) => idx.name === name)) await queryInterface.addIndex(tableName, fields, { ...options, name });
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "attendance_requests"))) return;

    await addColumnSafe(queryInterface, "attendance_requests", "submittedAt", { type: Sequelize.DATE, allowNull: true });
    await addColumnSafe(queryInterface, "attendance_requests", "approvedAt", { type: Sequelize.DATE, allowNull: true });
    await addColumnSafe(queryInterface, "attendance_requests", "approvedByUserId", { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" });
    await addColumnSafe(queryInterface, "attendance_requests", "rejectedAt", { type: Sequelize.DATE, allowNull: true });
    await addColumnSafe(queryInterface, "attendance_requests", "rejectedByUserId", { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" });
    await addColumnSafe(queryInterface, "attendance_requests", "reasonCategory", { type: Sequelize.STRING(80), allowNull: true });
    await addColumnSafe(queryInterface, "attendance_requests", "reasonText", { type: Sequelize.TEXT, allowNull: true });
    await addColumnSafe(queryInterface, "attendance_requests", "validityStatus", { type: Sequelize.STRING(40), allowNull: true });
    await addColumnSafe(queryInterface, "attendance_requests", "deadlineAt", { type: Sequelize.DATE, allowNull: true });

    await addIndexSafe(queryInterface, "attendance_requests", ["businessId", "requestType", "validityStatus"], "idx_attendance_requests_business_type_validity");
    await addIndexSafe(queryInterface, "attendance_requests", ["businessId", "employeeUserId", "submittedAt"], "idx_attendance_requests_business_employee_submitted");
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface, "attendance_requests"))) return;
    await removeColumnSafe(queryInterface, "attendance_requests", "deadlineAt");
    await removeColumnSafe(queryInterface, "attendance_requests", "validityStatus");
    await removeColumnSafe(queryInterface, "attendance_requests", "reasonText");
    await removeColumnSafe(queryInterface, "attendance_requests", "reasonCategory");
    await removeColumnSafe(queryInterface, "attendance_requests", "rejectedByUserId");
    await removeColumnSafe(queryInterface, "attendance_requests", "rejectedAt");
    await removeColumnSafe(queryInterface, "attendance_requests", "approvedByUserId");
    await removeColumnSafe(queryInterface, "attendance_requests", "approvedAt");
    await removeColumnSafe(queryInterface, "attendance_requests", "submittedAt");
  },
};
