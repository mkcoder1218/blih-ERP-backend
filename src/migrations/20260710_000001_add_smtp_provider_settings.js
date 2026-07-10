"use strict";

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.map((t) => (typeof t === "object" ? t.tableName || t.table_name : t)).includes(tableName);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "smtp_providers"))) {
      await queryInterface.createTable("smtp_providers", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        name: { type: Sequelize.STRING(120), allowNull: false },
        smtpHost: { type: Sequelize.STRING(255), allowNull: false },
        smtpPort: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 587 },
        encryptionType: { type: Sequelize.STRING(40), allowNull: false, defaultValue: "STARTTLS" },
        secureConnection: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        appPasswordRequired: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        instructions: { type: Sequelize.TEXT, allowNull: true },
        createdBy: { type: Sequelize.UUID, allowNull: true },
        updatedBy: { type: Sequelize.UUID, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        deletedAt: { type: Sequelize.DATE, allowNull: true },
      });
      await queryInterface.addIndex("smtp_providers", ["isActive"], { name: "smtp_providers_active_idx" });
    }

    if (!(await tableExists(queryInterface, "business_smtp_settings"))) {
      await queryInterface.createTable("business_smtp_settings", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        businessId: { type: Sequelize.UUID, allowNull: false, references: { model: "businesses", key: "id" }, onDelete: "CASCADE" },
        providerId: { type: Sequelize.UUID, allowNull: false, references: { model: "smtp_providers", key: "id" }, onDelete: "RESTRICT" },
        senderName: { type: Sequelize.STRING(160), allowNull: false },
        senderEmailEncrypted: { type: Sequelize.TEXT, allowNull: false },
        smtpUsernameEncrypted: { type: Sequelize.TEXT, allowNull: false },
        smtpPasswordEncrypted: { type: Sequelize.TEXT, allowNull: false },
        isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        lastTestedAt: { type: Sequelize.DATE, allowNull: true },
        lastTestStatus: { type: Sequelize.STRING(30), allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        deletedAt: { type: Sequelize.DATE, allowNull: true },
      });
      await queryInterface.addIndex("business_smtp_settings", ["businessId"], { unique: true, name: "business_smtp_settings_business_unique" });
      await queryInterface.addIndex("business_smtp_settings", ["providerId"], { name: "business_smtp_settings_provider_idx" });
    }
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, "business_smtp_settings")) {
      await queryInterface.dropTable("business_smtp_settings");
    }
    if (await tableExists(queryInterface, "smtp_providers")) {
      await queryInterface.dropTable("smtp_providers");
    }
  },
};
