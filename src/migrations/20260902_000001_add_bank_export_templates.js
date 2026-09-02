"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const normalizedTables = tables.map((table) =>
      typeof table === "string" ? table : table.tableName || table.name,
    );

    if (!normalizedTables.includes("finance_bank_export_templates")) {
      await queryInterface.createTable("finance_bank_export_templates", {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
        },
        businessId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: { model: "businesses", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        name: {
          type: Sequelize.STRING(160),
          allowNull: false,
        },
        headerHtml: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        bodyHtml: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        footerHtml: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        isDefault: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        createdByUserId: {
          type: Sequelize.UUID,
          allowNull: true,
        },
        updatedByUserId: {
          type: Sequelize.UUID,
          allowNull: true,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn("NOW"),
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn("NOW"),
        },
      });

      await queryInterface.addIndex(
        "finance_bank_export_templates",
        ["businessId", "isActive"],
        { name: "finance_bank_export_templates_business_active_idx" },
      );
      await queryInterface.addIndex(
        "finance_bank_export_templates",
        ["businessId", "isDefault"],
        { name: "finance_bank_export_templates_business_default_idx" },
      );
    }

    if (normalizedTables.includes("offer_letter_templates")) {
      const offerColumns = await queryInterface.describeTable("offer_letter_templates");
      if (!offerColumns.headerHtml) {
        await queryInterface.addColumn("offer_letter_templates", "headerHtml", {
          type: Sequelize.TEXT,
          allowNull: true,
        });
      }
      if (!offerColumns.footerHtml) {
        await queryInterface.addColumn("offer_letter_templates", "footerHtml", {
          type: Sequelize.TEXT,
          allowNull: true,
        });
      }
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const normalizedTables = tables.map((table) =>
      typeof table === "string" ? table : table.tableName || table.name,
    );

    if (normalizedTables.includes("offer_letter_templates")) {
      const offerColumns = await queryInterface.describeTable("offer_letter_templates");
      if (offerColumns.footerHtml) {
        await queryInterface.removeColumn("offer_letter_templates", "footerHtml");
      }
      if (offerColumns.headerHtml) {
        await queryInterface.removeColumn("offer_letter_templates", "headerHtml");
      }
    }

    if (normalizedTables.includes("finance_bank_export_templates")) {
      await queryInterface.dropTable("finance_bank_export_templates");
    }
  },
};
