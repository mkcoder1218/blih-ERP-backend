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
    if (!(await tableExists(queryInterface, "special_requests"))) {
      await queryInterface.createTable("special_requests", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        businessId: { type: Sequelize.UUID, allowNull: false, references: { model: "businesses", key: "id" }, onDelete: "CASCADE" },
        requestedBy: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
        requestedDate: { type: Sequelize.DATEONLY, allowNull: false },
        requestType: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "Special Request" },
        lunchUsageType: { type: Sequelize.STRING(20), allowNull: false, defaultValue: "PARTIAL" },
        requestedMinutes: { type: Sequelize.INTEGER, allowNull: false },
        reason: { type: Sequelize.TEXT, allowNull: false },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: "pending" },
        submittedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        approvedBy: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        approvedAt: { type: Sequelize.DATE, allowNull: true },
        rejectedBy: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        rejectedAt: { type: Sequelize.DATE, allowNull: true },
        rejectedReason: { type: Sequelize.TEXT, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        deletedAt: { type: Sequelize.DATE, allowNull: true },
      });
    }

    await addIndexSafe(queryInterface, "special_requests", ["businessId", "status"], "idx_special_requests_business_status");
    await addIndexSafe(queryInterface, "special_requests", ["businessId", "requestedBy", "requestedDate"], "idx_special_requests_business_requester_date");
    await addIndexSafe(queryInterface, "special_requests", ["businessId", "requestedDate"], "idx_special_requests_business_date");
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, "special_requests")) await queryInterface.dropTable("special_requests");
  }
};
