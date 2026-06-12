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
    if (!(await tableExists(queryInterface, 'businesses')) || !(await tableExists(queryInterface, 'users'))) {
      return;
    }

    if (!(await tableExists(queryInterface, 'attendance_events'))) {
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
    }

    await addIndexSafe(queryInterface, 'attendance_events', ['businessId'], 'attendance_events_businessId_idx');
    await addIndexSafe(queryInterface, 'attendance_events', ['employeeId'], 'attendance_events_employeeId_idx');
    await addIndexSafe(queryInterface, 'attendance_events', ['timestampUtc'], 'attendance_events_timestampUtc_idx');
    await addIndexSafe(queryInterface, 'attendance_events', ['type'], 'attendance_events_type_idx');
    await addIndexSafe(queryInterface, 'attendance_events', ['businessId', 'employeeId', 'timestampUtc'], 'attendance_events_biz_emp_time_idx');
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, 'attendance_events')) {
      await queryInterface.dropTable('attendance_events');
    }
  }
};
