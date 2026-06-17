"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("attendance_daily_reasons", {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      businessId: { type: Sequelize.UUID, allowNull: false, references: { model: "businesses", key: "id" }, onDelete: "CASCADE" },
      employeeId: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
      dateYmd: { type: Sequelize.STRING(10), allowNull: false },
      reasonType: { type: Sequelize.STRING(30), allowNull: false },
      lateReasonId: { type: Sequelize.UUID, allowNull: true, references: { model: "attendance_late_reasons", key: "id" }, onDelete: "SET NULL" },
      comment: { type: Sequelize.STRING(1000), allowNull: true },
      source: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "erp" },
      attendanceEventId: { type: Sequelize.UUID, allowNull: true, references: { model: "attendance_events", key: "id" }, onDelete: "SET NULL" },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") }
    });
    await queryInterface.addIndex("attendance_daily_reasons", ["businessId", "employeeId", "dateYmd", "reasonType"], { name: "attendance_daily_reasons_lookup_idx" });
    const links = await queryInterface.describeTable("telegram_account_links");
    if (!links.pendingAction) {
      await queryInterface.addColumn("telegram_account_links", "pendingAction", { type: Sequelize.JSONB, allowNull: true });
    }
  },

  async down(queryInterface) {
    const links = await queryInterface.describeTable("telegram_account_links");
    if (links.pendingAction) await queryInterface.removeColumn("telegram_account_links", "pendingAction");
    await queryInterface.dropTable("attendance_daily_reasons");
  }
};
