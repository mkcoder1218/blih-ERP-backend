"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("user_calendar_events");
    if (!table.syncSource) {
      await queryInterface.addColumn("user_calendar_events", "syncSource", {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "BLIH",
      });
    }
    if (!table.googleUpdatedAt) {
      await queryInterface.addColumn("user_calendar_events", "googleUpdatedAt", {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    if (!table.googleETag) {
      await queryInterface.addColumn("user_calendar_events", "googleETag", {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("user_calendar_events");
    if (table.googleETag) await queryInterface.removeColumn("user_calendar_events", "googleETag");
    if (table.googleUpdatedAt) await queryInterface.removeColumn("user_calendar_events", "googleUpdatedAt");
    if (table.syncSource) await queryInterface.removeColumn("user_calendar_events", "syncSource");
  },
};
