"use strict";

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "hr_employee_records"))) {
      return;
    }

    const table = await queryInterface.describeTable("hr_employee_records");
    if (!table.contractStartDate) {
      await queryInterface.addColumn("hr_employee_records", "contractStartDate", {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface, "hr_employee_records"))) {
      return;
    }

    const table = await queryInterface.describeTable("hr_employee_records");
    if (table.contractStartDate) {
      await queryInterface.removeColumn("hr_employee_records", "contractStartDate");
    }
  },
};
