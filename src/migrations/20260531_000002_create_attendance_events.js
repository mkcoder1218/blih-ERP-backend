'use strict';

/** @type {import('sequelize').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('attendance_events', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      businessId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'businesses', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      employeeId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      type: { type: Sequelize.STRING(20), allowNull: false },
      timestampUtc: { type: Sequelize.DATE, allowNull: false },
      latitude: { type: Sequelize.DECIMAL(10, 7), allowNull: false },
      longitude: { type: Sequelize.DECIMAL(10, 7), allowNull: false },
      distanceMeters: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      withinAllowedRadius: { type: Sequelize.BOOLEAN, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
    });

    await queryInterface.addIndex('attendance_events', ['businessId'], { name: 'attendance_events_businessId_idx' });
    await queryInterface.addIndex('attendance_events', ['employeeId'], { name: 'attendance_events_employeeId_idx' });
    await queryInterface.addIndex('attendance_events', ['timestampUtc'], { name: 'attendance_events_timestampUtc_idx' });
    await queryInterface.addIndex('attendance_events', ['type'], { name: 'attendance_events_type_idx' });
    await queryInterface.addIndex('attendance_events', ['businessId', 'employeeId', 'timestampUtc'], { name: 'attendance_events_biz_emp_time_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('attendance_events');
  }
};

