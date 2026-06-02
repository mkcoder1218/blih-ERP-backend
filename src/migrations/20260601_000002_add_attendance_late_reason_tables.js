'use strict';

/** @type {import('sequelize').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('attendance_late_reasons', {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      businessId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'businesses', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      name: { type: Sequelize.STRING(160), allowNull: false },
      description: { type: Sequelize.STRING(500), allowNull: true },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      requiresComment: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      createdBy: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
    });

    await queryInterface.addIndex('attendance_late_reasons', ['businessId'], { name: 'attendance_late_reasons_businessId_idx' });
    await queryInterface.addIndex('attendance_late_reasons', ['businessId', 'isActive'], { name: 'attendance_late_reasons_business_active_idx' });

    await queryInterface.createTable('attendance_late_explanations', {
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
      attendanceEventId: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'attendance_events', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      lateReasonId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'attendance_late_reasons', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      customReason: { type: Sequelize.STRING(800), allowNull: true },
      lateByMinutes: { type: Sequelize.INTEGER, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
    });

    await queryInterface.addIndex('attendance_late_explanations', ['businessId'], { name: 'attendance_late_explanations_businessId_idx' });
    await queryInterface.addIndex('attendance_late_explanations', ['employeeId'], { name: 'attendance_late_explanations_employeeId_idx' });
    await queryInterface.addIndex('attendance_late_explanations', ['attendanceEventId'], { name: 'attendance_late_explanations_eventId_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('attendance_late_explanations');
    await queryInterface.dropTable('attendance_late_reasons');
  }
};

