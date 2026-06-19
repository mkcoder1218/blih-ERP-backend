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
    if (!(await tableExists(queryInterface, "attendance_late_reasons"))) return;

    await addColumnSafe(queryInterface, "attendance_late_reasons", "reasonCode", { type: Sequelize.STRING(80), allowNull: true });
    await addColumnSafe(queryInterface, "attendance_late_reasons", "label", { type: Sequelize.STRING(160), allowNull: true });
    await addColumnSafe(queryInterface, "attendance_late_reasons", "enabled", { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true });
    await addColumnSafe(queryInterface, "attendance_late_reasons", "monthlyLimit", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
    await addColumnSafe(queryInterface, "attendance_late_reasons", "coversMinutes", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
    await addColumnSafe(queryInterface, "attendance_late_reasons", "requiresApproval", { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true });
    await addColumnSafe(queryInterface, "attendance_late_reasons", "requiresAttachment", { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });
    await addColumnSafe(queryInterface, "attendance_late_reasons", "allowAfterDeadline", { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });
    await addColumnSafe(queryInterface, "attendance_late_reasons", "behaviorWhenExceeded", { type: Sequelize.STRING(40), allowNull: false, defaultValue: "HR_REVIEW" });
    await addColumnSafe(queryInterface, "attendance_late_reasons", "sortOrder", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });

    await queryInterface.sequelize.query(`
      UPDATE attendance_late_reasons
      SET
        "reasonCode" = COALESCE("reasonCode", upper(regexp_replace(name, '[^A-Za-z0-9]+', '_', 'g'))),
        label = COALESCE(label, name),
        enabled = COALESCE(enabled, "isActive", true)
    `);

    await addIndexSafe(queryInterface, "attendance_late_reasons", ["businessId", "reasonCode"], "idx_attendance_late_reasons_business_code", { unique: true });
    await addIndexSafe(queryInterface, "attendance_late_reasons", ["businessId", "enabled", "sortOrder"], "idx_attendance_late_reasons_business_enabled_sort");
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface, "attendance_late_reasons"))) return;
    await removeColumnSafe(queryInterface, "attendance_late_reasons", "sortOrder");
    await removeColumnSafe(queryInterface, "attendance_late_reasons", "behaviorWhenExceeded");
    await removeColumnSafe(queryInterface, "attendance_late_reasons", "allowAfterDeadline");
    await removeColumnSafe(queryInterface, "attendance_late_reasons", "requiresAttachment");
    await removeColumnSafe(queryInterface, "attendance_late_reasons", "requiresApproval");
    await removeColumnSafe(queryInterface, "attendance_late_reasons", "coversMinutes");
    await removeColumnSafe(queryInterface, "attendance_late_reasons", "monthlyLimit");
    await removeColumnSafe(queryInterface, "attendance_late_reasons", "enabled");
    await removeColumnSafe(queryInterface, "attendance_late_reasons", "label");
    await removeColumnSafe(queryInterface, "attendance_late_reasons", "reasonCode");
  },
};
