"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("leave_requests");
    if (!table.businessAdminApprovedBy) {
      await queryInterface.addColumn("leave_requests", "businessAdminApprovedBy", {
        type: Sequelize.UUID,
        allowNull: true
      });
    }
    if (!table.businessAdminActionAt) {
      await queryInterface.addColumn("leave_requests", "businessAdminActionAt", {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    if (!table.businessAdminComment) {
      await queryInterface.addColumn("leave_requests", "businessAdminComment", {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("leave_requests");
    if (table.businessAdminComment) await queryInterface.removeColumn("leave_requests", "businessAdminComment");
    if (table.businessAdminActionAt) await queryInterface.removeColumn("leave_requests", "businessAdminActionAt");
    if (table.businessAdminApprovedBy) await queryInterface.removeColumn("leave_requests", "businessAdminApprovedBy");
  }
};
