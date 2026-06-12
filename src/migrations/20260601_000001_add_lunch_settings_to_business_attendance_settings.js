'use strict';

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

async function addColumnSafe(queryInterface, tableName, columnName, definition) {
  const table = await queryInterface.describeTable(tableName);
  if (!table[columnName]) await queryInterface.addColumn(tableName, columnName, definition);
}

async function removeColumnSafe(queryInterface, tableName, columnName) {
  const table = await queryInterface.describeTable(tableName);
  if (table[columnName]) await queryInterface.removeColumn(tableName, columnName);
}

/** @type {import('sequelize').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'business_attendance_settings'))) {
      return;
    }

    await addColumnSafe(queryInterface, 'business_attendance_settings', 'lunchBreakEnabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    await addColumnSafe(queryInterface, 'business_attendance_settings', 'lunchMode', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'FLEXIBLE',
    });

    await addColumnSafe(queryInterface, 'business_attendance_settings', 'fixedLunchStartTime', {
      type: Sequelize.STRING(5),
      allowNull: true,
    });

    await addColumnSafe(queryInterface, 'business_attendance_settings', 'fixedLunchEndTime', {
      type: Sequelize.STRING(5),
      allowNull: true,
    });

    await addColumnSafe(queryInterface, 'business_attendance_settings', 'allowMultipleLunchBreaks', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface, 'business_attendance_settings'))) {
      return;
    }

    await removeColumnSafe(queryInterface, 'business_attendance_settings', 'allowMultipleLunchBreaks');
    await removeColumnSafe(queryInterface, 'business_attendance_settings', 'fixedLunchEndTime');
    await removeColumnSafe(queryInterface, 'business_attendance_settings', 'fixedLunchStartTime');
    await removeColumnSafe(queryInterface, 'business_attendance_settings', 'lunchMode');
    await removeColumnSafe(queryInterface, 'business_attendance_settings', 'lunchBreakEnabled');
  }
};
