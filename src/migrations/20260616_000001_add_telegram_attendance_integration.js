"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("telegram_bot_settings", {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      businessId: { type: Sequelize.UUID, allowNull: false, references: { model: "businesses", key: "id" }, onDelete: "CASCADE" },
      botType: { type: Sequelize.STRING(40), allowNull: false },
      botToken: { type: Sequelize.STRING(220), allowNull: true },
      chatId: { type: Sequelize.STRING(120), allowNull: true },
      sendTime: { type: Sequelize.STRING(5), allowNull: true },
      timezone: { type: Sequelize.STRING(80), allowNull: false, defaultValue: "UTC" },
      enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      updateOffset: { type: Sequelize.INTEGER, allowNull: true },
      lastSentForDate: { type: Sequelize.STRING(10), allowNull: true },
      lastSentAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") }
    });
    await queryInterface.addIndex("telegram_bot_settings", ["businessId", "botType"], { unique: true, name: "telegram_bot_settings_business_type_unique" });

    await queryInterface.createTable("telegram_account_links", {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      businessId: { type: Sequelize.UUID, allowNull: false, references: { model: "businesses", key: "id" }, onDelete: "CASCADE" },
      userId: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
      telegramUserId: { type: Sequelize.STRING(80), allowNull: false },
      telegramChatId: { type: Sequelize.STRING(120), allowNull: false },
      telegramUsername: { type: Sequelize.STRING(160), allowNull: true },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      linkedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      unlinkedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") }
    });
    await queryInterface.addIndex("telegram_account_links", ["businessId", "userId"], { unique: true, name: "telegram_account_links_business_user_unique" });
    await queryInterface.addIndex("telegram_account_links", ["businessId", "telegramUserId"], { unique: true, name: "telegram_account_links_business_telegram_user_unique" });

    await queryInterface.createTable("telegram_link_codes", {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      businessId: { type: Sequelize.UUID, allowNull: false, references: { model: "businesses", key: "id" }, onDelete: "CASCADE" },
      userId: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" }, onDelete: "CASCADE" },
      codeHash: { type: Sequelize.STRING(128), allowNull: false, unique: true },
      expiresAt: { type: Sequelize.DATE, allowNull: false },
      usedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") }
    });

    await queryInterface.createTable("telegram_notification_logs", {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      businessId: { type: Sequelize.UUID, allowNull: false, references: { model: "businesses", key: "id" }, onDelete: "CASCADE" },
      botType: { type: Sequelize.STRING(40), allowNull: false },
      recipientChatId: { type: Sequelize.STRING(120), allowNull: true },
      eventType: { type: Sequelize.STRING(80), allowNull: false },
      status: { type: Sequelize.STRING(30), allowNull: false },
      payload: { type: Sequelize.JSONB, allowNull: true },
      errorMessage: { type: Sequelize.TEXT, allowNull: true },
      sentAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("telegram_notification_logs");
    await queryInterface.dropTable("telegram_link_codes");
    await queryInterface.dropTable("telegram_account_links");
    await queryInterface.dropTable("telegram_bot_settings");
  }
};
