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

async function changeColumnSafe(queryInterface, tableName, columnName, definition) {
  const table = await queryInterface.describeTable(tableName);
  if (table[columnName]) await queryInterface.changeColumn(tableName, columnName, definition);
}

async function addIndexSafe(queryInterface, tableName, fields, name, options = {}) {
  const indexes = await queryInterface.showIndex(tableName);
  if (!indexes.some((idx) => idx.name === name)) await queryInterface.addIndex(tableName, fields, { ...options, name });
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "overtime_requests"))) return;

    await changeColumnSafe(queryInterface, "overtime_requests", "startTime", { type: Sequelize.STRING(10), allowNull: true });
    await changeColumnSafe(queryInterface, "overtime_requests", "endTime", { type: Sequelize.STRING(10), allowNull: true });
    await addColumnSafe(queryInterface, "overtime_requests", "requestedDate", { type: Sequelize.DATEONLY, allowNull: true });
    await addColumnSafe(queryInterface, "overtime_requests", "expectedDurationMinutes", { type: Sequelize.INTEGER, allowNull: true });
    await addColumnSafe(queryInterface, "overtime_requests", "expectedEndTime", { type: Sequelize.STRING(10), allowNull: true });
    await addColumnSafe(queryInterface, "overtime_requests", "requestedAtUtc", { type: Sequelize.DATE, allowNull: true });
    await addColumnSafe(queryInterface, "overtime_requests", "requestedBy", { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" });
    await addColumnSafe(queryInterface, "overtime_requests", "approvedBy", { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" });
    await addColumnSafe(queryInterface, "overtime_requests", "approvedAtUtc", { type: Sequelize.DATE, allowNull: true });
    await addColumnSafe(queryInterface, "overtime_requests", "overtimeStartedAtUtc", { type: Sequelize.DATE, allowNull: true });
    await addColumnSafe(queryInterface, "overtime_requests", "closedBy", { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" });
    await addColumnSafe(queryInterface, "overtime_requests", "closedAtUtc", { type: Sequelize.DATE, allowNull: true });
    await addColumnSafe(queryInterface, "overtime_requests", "overtimeClosedAtUtc", { type: Sequelize.DATE, allowNull: true });
    await addColumnSafe(queryInterface, "overtime_requests", "approvedOvertimeMinutes", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });

    await addIndexSafe(queryInterface, "overtime_requests", ["businessId", "employeeUserId", "requestedDate", "status"], "idx_overtime_requests_employee_date_status");
    await addIndexSafe(queryInterface, "overtime_requests", ["businessId", "status", "overtimeStartedAtUtc"], "idx_overtime_requests_status_started");
    await addIndexSafe(queryInterface, "overtime_requests", ["businessId", "status", "overtimeClosedAtUtc"], "idx_overtime_requests_status_closed");
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface, "overtime_requests"))) return;
    await removeColumnSafe(queryInterface, "overtime_requests", "approvedOvertimeMinutes");
    await removeColumnSafe(queryInterface, "overtime_requests", "overtimeClosedAtUtc");
    await removeColumnSafe(queryInterface, "overtime_requests", "closedAtUtc");
    await removeColumnSafe(queryInterface, "overtime_requests", "closedBy");
    await removeColumnSafe(queryInterface, "overtime_requests", "overtimeStartedAtUtc");
    await removeColumnSafe(queryInterface, "overtime_requests", "approvedAtUtc");
    await removeColumnSafe(queryInterface, "overtime_requests", "approvedBy");
    await removeColumnSafe(queryInterface, "overtime_requests", "requestedBy");
    await removeColumnSafe(queryInterface, "overtime_requests", "requestedAtUtc");
    await removeColumnSafe(queryInterface, "overtime_requests", "expectedEndTime");
    await removeColumnSafe(queryInterface, "overtime_requests", "expectedDurationMinutes");
    await removeColumnSafe(queryInterface, "overtime_requests", "requestedDate");
  },
};
