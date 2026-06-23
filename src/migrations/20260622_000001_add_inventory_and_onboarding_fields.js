"use strict";

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch (_err) {
    return false;
  }
}

async function addIndexSafe(queryInterface, tableName, fields, name, options = {}) {
  const indexes = await queryInterface.showIndex(tableName).catch(() => []);
  if (!indexes.some((idx) => idx.name === name)) {
    await queryInterface.addIndex(tableName, fields, { ...options, name });
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "inventory_items"))) {
      await queryInterface.createTable("inventory_items", {
        id: { type: Sequelize.UUID, allowNull: false, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
        businessId: { type: Sequelize.UUID, allowNull: false },
        name: { type: Sequelize.STRING(255), allowNull: false },
        category: { type: Sequelize.STRING(120), allowNull: false, defaultValue: "equipment" },
        assetTag: { type: Sequelize.STRING(120), allowNull: true },
        serialNumber: { type: Sequelize.STRING(160), allowNull: true },
        condition: { type: Sequelize.STRING(80), allowNull: false, defaultValue: "New" },
        status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "AVAILABLE" },
        assignedToUserId: { type: Sequelize.UUID, allowNull: true },
        reservedForOnboardingId: { type: Sequelize.UUID, allowNull: true },
        notes: { type: Sequelize.TEXT, allowNull: true },
        metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
        deletedAt: { type: Sequelize.DATE, allowNull: true },
      });
    }
    await addIndexSafe(queryInterface, "inventory_items", ["businessId"], "idx_inventory_items_business");
    await addIndexSafe(queryInterface, "inventory_items", ["status"], "idx_inventory_items_status");
    await addIndexSafe(queryInterface, "inventory_items", ["reservedForOnboardingId"], "idx_inventory_items_reserved_onboarding");
    await addIndexSafe(queryInterface, "inventory_items", ["assignedToUserId"], "idx_inventory_items_assigned_user");
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, "inventory_items")) {
      await queryInterface.dropTable("inventory_items");
    }
  },
};
