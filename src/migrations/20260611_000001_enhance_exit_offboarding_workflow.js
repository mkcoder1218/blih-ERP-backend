"use strict";

async function tableExists(queryInterface, tableName) {
  try { await queryInterface.describeTable(tableName); return true; } catch { return false; }
}

async function addColumnSafe(queryInterface, tableName, columnName, definition) {
  const table = await queryInterface.describeTable(tableName);
  if (!table[columnName]) await queryInterface.addColumn(tableName, columnName, definition);
}

async function removeColumnSafe(queryInterface, tableName, columnName) {
  const table = await queryInterface.describeTable(tableName);
  if (table[columnName]) await queryInterface.removeColumn(tableName, columnName);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (await tableExists(queryInterface, "hr_exit_processes")) {
      await addColumnSafe(queryInterface, "hr_exit_processes", "reviewedByUserId", { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" });
      await addColumnSafe(queryInterface, "hr_exit_processes", "reviewedAt", { type: Sequelize.DATE, allowNull: true });
      await addColumnSafe(queryInterface, "hr_exit_processes", "approvalNote", { type: Sequelize.TEXT, allowNull: true });
      await addColumnSafe(queryInterface, "hr_exit_processes", "rejectionReason", { type: Sequelize.TEXT, allowNull: true });
      await addColumnSafe(queryInterface, "hr_exit_processes", "accountDisabledAt", { type: Sequelize.DATE, allowNull: true });
      await addColumnSafe(queryInterface, "hr_exit_processes", "accountDisabledByUserId", { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" });
    }

    if (await tableExists(queryInterface, "hr_exit_interviews")) {
      await addColumnSafe(queryInterface, "hr_exit_interviews", "title", { type: Sequelize.STRING(255), allowNull: true });
      await addColumnSafe(queryInterface, "hr_exit_interviews", "startTime", { type: Sequelize.STRING(20), allowNull: true });
      await addColumnSafe(queryInterface, "hr_exit_interviews", "endTime", { type: Sequelize.STRING(20), allowNull: true });
      await addColumnSafe(queryInterface, "hr_exit_interviews", "interviewType", { type: Sequelize.STRING(50), allowNull: true });
      await addColumnSafe(queryInterface, "hr_exit_interviews", "panel", { type: Sequelize.JSONB, allowNull: false, defaultValue: [] });
      await addColumnSafe(queryInterface, "hr_exit_interviews", "employeeConcerns", { type: Sequelize.TEXT, allowNull: true });
      await addColumnSafe(queryInterface, "hr_exit_interviews", "rehireEligibility", { type: Sequelize.BOOLEAN, allowNull: true });
      await addColumnSafe(queryInterface, "hr_exit_interviews", "handoverNotes", { type: Sequelize.TEXT, allowNull: true });
      await addColumnSafe(queryInterface, "hr_exit_interviews", "finalRecommendation", { type: Sequelize.TEXT, allowNull: true });
    }

    if (await tableExists(queryInterface, "hr_exit_clearance_steps")) {
      await addColumnSafe(queryInterface, "hr_exit_clearance_steps", "blockedReason", { type: Sequelize.TEXT, allowNull: true });
      await addColumnSafe(queryInterface, "hr_exit_clearance_steps", "attachments", { type: Sequelize.JSONB, allowNull: false, defaultValue: [] });
    }
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, "hr_exit_clearance_steps")) {
      await removeColumnSafe(queryInterface, "hr_exit_clearance_steps", "attachments");
      await removeColumnSafe(queryInterface, "hr_exit_clearance_steps", "blockedReason");
    }
    if (await tableExists(queryInterface, "hr_exit_interviews")) {
      for (const column of ["finalRecommendation", "handoverNotes", "rehireEligibility", "employeeConcerns", "panel", "interviewType", "endTime", "startTime", "title"]) {
        await removeColumnSafe(queryInterface, "hr_exit_interviews", column);
      }
    }
    if (await tableExists(queryInterface, "hr_exit_processes")) {
      for (const column of ["accountDisabledByUserId", "accountDisabledAt", "rejectionReason", "approvalNote", "reviewedAt", "reviewedByUserId"]) {
        await removeColumnSafe(queryInterface, "hr_exit_processes", column);
      }
    }
  }
};
