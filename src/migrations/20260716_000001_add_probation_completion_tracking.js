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
    const tableName = 'hr_employee_records';
    if (!(await tableExists(queryInterface, tableName))) return;

    if (!(await columnExists(queryInterface, tableName, 'probationCompletedAt'))) {
      await queryInterface.addColumn(tableName, 'probationCompletedAt', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }

    if (!(await columnExists(queryInterface, tableName, 'completionEmailSentAt'))) {
      await queryInterface.addColumn(tableName, 'completionEmailSentAt', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    const tableName = 'hr_employee_records';
    if (!(await tableExists(queryInterface, tableName))) return;

    if (await columnExists(queryInterface, tableName, 'completionEmailSentAt')) {
      await queryInterface.removeColumn(tableName, 'completionEmailSentAt');
    }
    if (await columnExists(queryInterface, tableName, 'probationCompletedAt')) {
      await queryInterface.removeColumn(tableName, 'probationCompletedAt');
    }
  }
};
