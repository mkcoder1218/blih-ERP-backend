'use strict';

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

async function addIndexSafe(queryInterface, tableName, fields, name, options = {}) {
  const indexes = await queryInterface.showIndex(tableName);
  if (!indexes.some((idx) => idx.name === name)) {
    await queryInterface.addIndex(tableName, fields, { ...options, name });
  }
}

/** @type {import('sequelize').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (
      !(await tableExists(queryInterface, 'businesses')) ||
      !(await tableExists(queryInterface, 'users')) ||
      !(await tableExists(queryInterface, 'attendance_events'))
    ) {
      return;
    }

    if (!(await tableExists(queryInterface, 'attendance_late_reasons'))) {
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
    }

    await addIndexSafe(queryInterface, 'attendance_late_reasons', ['businessId'], 'attendance_late_reasons_businessId_idx');
    await addIndexSafe(queryInterface, 'attendance_late_reasons', ['businessId', 'isActive'], 'attendance_late_reasons_business_active_idx');

    if (!(await tableExists(queryInterface, 'attendance_late_explanations'))) {
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
    }

    await addIndexSafe(queryInterface, 'attendance_late_explanations', ['businessId'], 'attendance_late_explanations_businessId_idx');
    await addIndexSafe(queryInterface, 'attendance_late_explanations', ['employeeId'], 'attendance_late_explanations_employeeId_idx');
    await addIndexSafe(queryInterface, 'attendance_late_explanations', ['attendanceEventId'], 'attendance_late_explanations_eventId_idx');
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'attendance_late_explanations')) await queryInterface.dropTable('attendance_late_explanations');
    if (await tableExists(queryInterface, 'attendance_late_reasons')) await queryInterface.dropTable('attendance_late_reasons');
  }
};
