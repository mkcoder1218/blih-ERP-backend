"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("users", "preferredLanguage", {
      type: Sequelize.STRING(10),
      allowNull: false,
      defaultValue: "en",
    });

    await queryInterface.addColumn("business_localizations", "supportedLanguages", {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: ["en", "am", "ti", "om"],
    });

    await queryInterface.addColumn("business_localizations", "fallbackLanguage", {
      type: Sequelize.STRING(10),
      allowNull: false,
      defaultValue: "en",
    });

    await queryInterface.createTable("localized_content_translations", {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      businessId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "businesses", key: "id" },
        onDelete: "CASCADE",
      },
      entityType: { type: Sequelize.STRING(120), allowNull: false },
      entityId: { type: Sequelize.STRING(191), allowNull: false },
      field: { type: Sequelize.STRING(120), allowNull: false },
      language: { type: Sequelize.STRING(10), allowNull: false },
      value: { type: Sequelize.TEXT, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });

    await queryInterface.addIndex(
      "localized_content_translations",
      ["businessId", "entityType", "entityId", "field", "language"],
      { unique: true, name: "localized_content_translations_unique" },
    );
    await queryInterface.addIndex(
      "localized_content_translations",
      ["businessId", "entityType", "entityId"],
      { name: "localized_content_translations_entity_idx" },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("localized_content_translations");
    await queryInterface.removeColumn("business_localizations", "fallbackLanguage");
    await queryInterface.removeColumn("business_localizations", "supportedLanguages");
    await queryInterface.removeColumn("users", "preferredLanguage");
  },
};
