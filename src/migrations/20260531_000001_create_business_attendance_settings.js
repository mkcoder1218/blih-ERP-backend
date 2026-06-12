'use strict';

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

/** @type {import('sequelize').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'businesses'))) {
      return;
    }

    if (await tableExists(queryInterface, 'business_attendance_settings')) {
      return;
    }

    await queryInterface.createTable('business_attendance_settings', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      businessId: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'businesses', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      attendanceEnabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      locationName: { type: Sequelize.STRING(160), allowNull: true },
      address: { type: Sequelize.STRING(500), allowNull: true },
      latitude: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      longitude: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      allowedRadiusMeters: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 100 },
      timezone: { type: Sequelize.STRING(80), allowNull: false, defaultValue: 'UTC' },
      expectedDailyMinutes: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 480 },
      defaultStartTime: { type: Sequelize.STRING(5), allowNull: false, defaultValue: '09:00' },
      defaultEndTime: { type: Sequelize.STRING(5), allowNull: false, defaultValue: '17:00' },
      lateGracePeriodMinutes: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
    });
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'business_attendance_settings')) {
      await queryInterface.dropTable('business_attendance_settings');
    }
  }
};
