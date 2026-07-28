"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableExists = await queryInterface.tableExists("policies");
    if (!tableExists) {
      return;
    }

    const tableInfo = await queryInterface.describeTable("policies");
    if (tableInfo.summary) {
      return;
    }

    await queryInterface.addColumn("policies", "summary", {
      type: Sequelize.TEXT,
      allowNull: true,
      defaultValue: null
    });
  },

  async down(queryInterface) {
    const tableExists = await queryInterface.tableExists("policies");
    if (!tableExists) {
      return;
    }

    const tableInfo = await queryInterface.describeTable("policies");
    if (!tableInfo.summary) {
      return;
    }

    await queryInterface.removeColumn("policies", "summary");
  }
};
