"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
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
    await queryInterface.addIndex("inventory_items", ["businessId"]);
    await queryInterface.addIndex("inventory_items", ["status"]);
    await queryInterface.addIndex("inventory_items", ["reservedForOnboardingId"]);
    await queryInterface.addIndex("inventory_items", ["assignedToUserId"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("inventory_items");
  },
};
