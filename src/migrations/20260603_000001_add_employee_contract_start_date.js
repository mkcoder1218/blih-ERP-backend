"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("hr_employee_records");
    if (!table.contractStartDate) {
      await queryInterface.addColumn("hr_employee_records", "contractStartDate", {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("hr_employee_records");
    if (table.contractStartDate) {
      await queryInterface.removeColumn("hr_employee_records", "contractStartDate");
    }
  },
};
