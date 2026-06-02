'use strict';

/** @type {import('sequelize').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('business_attendance_settings', 'lunchBreakEnabled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    await queryInterface.addColumn('business_attendance_settings', 'lunchMode', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'FLEXIBLE',
    });

    await queryInterface.addColumn('business_attendance_settings', 'fixedLunchStartTime', {
      type: Sequelize.STRING(5),
      allowNull: true,
    });

    await queryInterface.addColumn('business_attendance_settings', 'fixedLunchEndTime', {
      type: Sequelize.STRING(5),
      allowNull: true,
    });

    await queryInterface.addColumn('business_attendance_settings', 'allowMultipleLunchBreaks', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('business_attendance_settings', 'allowMultipleLunchBreaks');
    await queryInterface.removeColumn('business_attendance_settings', 'fixedLunchEndTime');
    await queryInterface.removeColumn('business_attendance_settings', 'fixedLunchStartTime');
    await queryInterface.removeColumn('business_attendance_settings', 'lunchMode');
    await queryInterface.removeColumn('business_attendance_settings', 'lunchBreakEnabled');
  }
};

