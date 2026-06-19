"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const templateTable = await queryInterface.describeTable("leave_templates");
    if (!templateTable.hasAmount) {
      await queryInterface.addColumn("leave_templates", "hasAmount", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
    }
  },

  async down(queryInterface) {
    const templateTable = await queryInterface.describeTable("leave_templates");
    if (templateTable.hasAmount) {
      await queryInterface.removeColumn("leave_templates", "hasAmount");
    }
  }
};
