"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("user_calendar_events");
    if (!table.googleSyncStatus) {
      await queryInterface.addColumn("user_calendar_events", "googleSyncStatus", {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "NOT_SYNCED",
      });
    }
    if (!table.googleSyncError) {
      await queryInterface.addColumn("user_calendar_events", "googleSyncError", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
    if (!table.lastGoogleSyncedAt) {
      await queryInterface.addColumn("user_calendar_events", "lastGoogleSyncedAt", {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("user_calendar_events");
    if (table.lastGoogleSyncedAt) await queryInterface.removeColumn("user_calendar_events", "lastGoogleSyncedAt");
    if (table.googleSyncError) await queryInterface.removeColumn("user_calendar_events", "googleSyncError");
    if (table.googleSyncStatus) await queryInterface.removeColumn("user_calendar_events", "googleSyncStatus");
  },
};
