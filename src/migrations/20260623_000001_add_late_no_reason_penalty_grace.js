"use strict";

async function describeTableSafe(queryInterface, tableName) {
  try {
    return await queryInterface.describeTable(tableName);
  } catch {
    return null;
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await describeTableSafe(queryInterface, "business_attendance_settings");
    if (!table || table.lateNoReasonPenaltyGraceMinutes) return;
    await queryInterface.addColumn("business_attendance_settings", "lateNoReasonPenaltyGraceMinutes", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    const table = await describeTableSafe(queryInterface, "business_attendance_settings");
    if (!table || !table.lateNoReasonPenaltyGraceMinutes) return;
    await queryInterface.removeColumn("business_attendance_settings", "lateNoReasonPenaltyGraceMinutes");
  },
};
