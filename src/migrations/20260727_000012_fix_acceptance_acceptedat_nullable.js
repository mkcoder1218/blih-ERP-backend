"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableExists = await queryInterface.tableExists("policy_acceptances");
    if (!tableExists) {
      return;
    }

    const tableInfo = await queryInterface.describeTable("policy_acceptances");
    if (!tableInfo.acceptedAt) {
      return;
    }

    // The acceptedAt column was created NOT NULL by a prior sync but the model
    // defines it as allowNull: true. Pending/viewed/overdue acceptances must
    // be allowed to have NULL acceptedAt.
    await queryInterface.changeColumn("policy_acceptances", "acceptedAt", {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });
  },

  async down(queryInterface, Sequelize) {
    const tableExists = await queryInterface.tableExists("policy_acceptances");
    if (!tableExists) {
      return;
    }

    const tableInfo = await queryInterface.describeTable("policy_acceptances");
    if (!tableInfo.acceptedAt) {
      return;
    }

    await queryInterface.changeColumn("policy_acceptances", "acceptedAt", {
      type: Sequelize.DATE,
      allowNull: false
    });
  }
};
