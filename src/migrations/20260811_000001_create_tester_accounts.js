"use strict";

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.includes(tableName);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const userColumns = await queryInterface.describeTable("users");

    if (!userColumns.isTestAccount) {
      await queryInterface.addColumn("users", "isTestAccount", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    if (!(await tableExists(queryInterface, "tester_accounts"))) {
      await queryInterface.createTable("tester_accounts", {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        userId: {
          type: Sequelize.UUID,
          allowNull: false,
          unique: true,
          references: { model: "users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        testerLevel: {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: "STANDARD",
        },
        createdByTesterUserId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: "users", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
        safetyMode: {
          type: Sequelize.STRING(30),
          allowNull: false,
          defaultValue: "RESTRICTED",
        },
        notes: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        metadata: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {},
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
      });

      await queryInterface.addIndex("tester_accounts", ["testerLevel"], {
        name: "tester_accounts_level_idx",
      });

      await queryInterface.addIndex("tester_accounts", ["createdByTesterUserId"], {
        name: "tester_accounts_creator_idx",
      });
    }
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, "tester_accounts")) {
      await queryInterface.dropTable("tester_accounts");
    }

    const userColumns = await queryInterface.describeTable("users");
    if (userColumns.isTestAccount) {
      await queryInterface.removeColumn("users", "isTestAccount");
    }
  },
};
