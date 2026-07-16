"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("candidate_onboardings");
    if (!table.completedAt) {
      await queryInterface.addColumn("candidate_onboardings", "completedAt", {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("candidate_onboardings");
    if (table.completedAt) {
      await queryInterface.removeColumn("candidate_onboardings", "completedAt");
    }
  },
};
