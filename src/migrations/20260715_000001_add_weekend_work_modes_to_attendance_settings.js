'use strict';

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

async function columnExists(queryInterface, tableName, columnName) {
  try {
    const table = await queryInterface.describeTable(tableName);
    return Boolean(table[columnName]);
  } catch {
    return false;
  }
}

/** @type {import('sequelize').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'business_attendance_settings';
    if (!(await tableExists(queryInterface, tableName))) return;

    if (!(await columnExists(queryInterface, tableName, 'saturdayWorkMode'))) {
      await queryInterface.addColumn(tableName, 'saturdayWorkMode', {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'PAID_DAY_OFF'
      });
    }

    if (!(await columnExists(queryInterface, tableName, 'sundayWorkMode'))) {
      await queryInterface.addColumn(tableName, 'sundayWorkMode', {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: 'PAID_DAY_OFF'
      });
    }
  },

  async down(queryInterface) {
    const tableName = 'business_attendance_settings';
    if (!(await tableExists(queryInterface, tableName))) return;

    if (await columnExists(queryInterface, tableName, 'sundayWorkMode')) {
      await queryInterface.removeColumn(tableName, 'sundayWorkMode');
    }
    if (await columnExists(queryInterface, tableName, 'saturdayWorkMode')) {
      await queryInterface.removeColumn(tableName, 'saturdayWorkMode');
    }
  }
};
