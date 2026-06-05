"use strict";

async function tableExists(queryInterface, tableName) {
  try { await queryInterface.describeTable(tableName); return true; } catch { return false; }
}

async function addIndexSafe(queryInterface, tableName, fields, name, options = {}) {
  const indexes = await queryInterface.showIndex(tableName);
  if (!indexes.some((idx) => idx.name === name)) await queryInterface.addIndex(tableName, fields, { ...options, name });
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "attendance_requests"))) {
      await queryInterface.createTable("attendance_requests", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        businessId: { type: Sequelize.UUID, allowNull: false, references: { model: "businesses", key: "id" }, onDelete: "CASCADE" },
        employeeUserId: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
        requestType: { type: Sequelize.STRING(40), allowNull: false },
        category: { type: Sequelize.STRING(120), allowNull: true },
        title: { type: Sequelize.STRING(255), allowNull: false },
        reason: { type: Sequelize.TEXT, allowNull: false },
        fromAt: { type: Sequelize.DATE, allowNull: true },
        toAt: { type: Sequelize.DATE, allowNull: true },
        durationMinutes: { type: Sequelize.INTEGER, allowNull: true },
        status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "pending" },
        actionedAt: { type: Sequelize.DATE, allowNull: true },
        actionedByUserId: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        actionNote: { type: Sequelize.TEXT, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        deletedAt: { type: Sequelize.DATE, allowNull: true }
      });
    }

    await addIndexSafe(queryInterface, "attendance_requests", ["businessId", "requestType", "status"], "idx_attendance_requests_business_type_status");
    await addIndexSafe(queryInterface, "attendance_requests", ["businessId", "employeeUserId"], "idx_attendance_requests_business_employee");
    await addIndexSafe(queryInterface, "attendance_requests", ["businessId", "createdAt"], "idx_attendance_requests_business_created");
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, "attendance_requests")) await queryInterface.dropTable("attendance_requests");
  }
};
