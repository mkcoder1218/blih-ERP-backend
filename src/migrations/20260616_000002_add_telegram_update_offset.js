"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("telegram_bot_settings");
    if (!table.updateOffset) {
      await queryInterface.addColumn("telegram_bot_settings", "updateOffset", {
        type: Sequelize.INTEGER,
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("telegram_bot_settings");
    if (table.updateOffset) {
      await queryInterface.removeColumn("telegram_bot_settings", "updateOffset");
    }
  }
};
