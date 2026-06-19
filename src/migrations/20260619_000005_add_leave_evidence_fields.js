"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const templateTable = await queryInterface.describeTable("leave_templates");
    if (!templateTable.requiresEvidence) {
      await queryInterface.addColumn("leave_templates", "requiresEvidence", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }
    if (!templateTable.evidenceInstructions) {
      await queryInterface.addColumn("leave_templates", "evidenceInstructions", {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }

    const requestTable = await queryInterface.describeTable("leave_requests");
    if (!requestTable.evidenceUrl) {
      await queryInterface.addColumn("leave_requests", "evidenceUrl", {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }
    if (!requestTable.evidenceNote) {
      await queryInterface.addColumn("leave_requests", "evidenceNote", {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    const requestTable = await queryInterface.describeTable("leave_requests");
    if (requestTable.evidenceNote) await queryInterface.removeColumn("leave_requests", "evidenceNote");
    if (requestTable.evidenceUrl) await queryInterface.removeColumn("leave_requests", "evidenceUrl");

    const templateTable = await queryInterface.describeTable("leave_templates");
    if (templateTable.evidenceInstructions) await queryInterface.removeColumn("leave_templates", "evidenceInstructions");
    if (templateTable.requiresEvidence) await queryInterface.removeColumn("leave_templates", "requiresEvidence");
  }
};
