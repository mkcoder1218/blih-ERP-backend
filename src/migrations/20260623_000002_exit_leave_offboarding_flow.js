"use strict";

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
    await addColumnSafe(queryInterface, "hr_exit_processes", "leaveStartedAt", { type: Sequelize.DATE, allowNull: true });
    await addColumnSafe(queryInterface, "hr_exit_processes", "leaveEndsAt", { type: Sequelize.DATE, allowNull: true });
    await addColumnSafe(queryInterface, "hr_exit_processes", "offboardingFormSentAt", { type: Sequelize.DATE, allowNull: true });
    await addColumnSafe(queryInterface, "hr_exit_processes", "offboardingFormSentByUserId", { type: Sequelize.UUID, allowNull: true });
    await addColumnSafe(queryInterface, "hr_exit_processes", "offboardingFormSubmittedAt", { type: Sequelize.DATE, allowNull: true });
    await addColumnSafe(queryInterface, "hr_exit_processes", "offboardingFormData", { type: Sequelize.JSONB, allowNull: false, defaultValue: {} });
  },

  async down(queryInterface) {
    await removeColumnSafe(queryInterface, "hr_exit_processes", "offboardingFormData");
    await removeColumnSafe(queryInterface, "hr_exit_processes", "offboardingFormSubmittedAt");
    await removeColumnSafe(queryInterface, "hr_exit_processes", "offboardingFormSentByUserId");
    await removeColumnSafe(queryInterface, "hr_exit_processes", "offboardingFormSentAt");
    await removeColumnSafe(queryInterface, "hr_exit_processes", "leaveEndsAt");
    await removeColumnSafe(queryInterface, "hr_exit_processes", "leaveStartedAt");
  },
};
