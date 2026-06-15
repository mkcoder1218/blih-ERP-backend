"use strict";

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
  if (!indexes.some((idx) => idx.name === name)) await queryInterface.addIndex(tableName, fields, { ...options, name });
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "trusted_devices"))) {
      await queryInterface.createTable("trusted_devices", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        businessId: { type: Sequelize.UUID, allowNull: false, references: { model: "businesses", key: "id" }, onDelete: "CASCADE" },
        userId: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
        deviceKey: { type: Sequelize.STRING(120), allowNull: false },
        deviceSignature: { type: Sequelize.STRING(255), allowNull: true },
        label: { type: Sequelize.STRING(160), allowNull: false },
        userAgent: { type: Sequelize.TEXT, allowNull: true },
        status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "approved" },
        lastSeenAt: { type: Sequelize.DATE, allowNull: true },
        approvedAt: { type: Sequelize.DATE, allowNull: true },
        approvedByUserId: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        rejectedAt: { type: Sequelize.DATE, allowNull: true },
        rejectedByUserId: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        deletedAt: { type: Sequelize.DATE, allowNull: true },
      });
    }

    await addIndexSafe(queryInterface, "trusted_devices", ["businessId", "userId", "deviceKey"], "uniq_trusted_devices_business_user_key", { unique: true });
    await addIndexSafe(queryInterface, "trusted_devices", ["businessId", "userId", "deviceSignature"], "idx_trusted_devices_business_user_signature");
    await addIndexSafe(queryInterface, "trusted_devices", ["businessId", "status"], "idx_trusted_devices_business_status");
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, "trusted_devices")) await queryInterface.dropTable("trusted_devices");
  },
};
