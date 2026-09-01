"use strict";

const TABLE_NAME = "hr_events";

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

async function indexExists(queryInterface, tableName, indexName) {
  try {
    const indexes = await queryInterface.showIndex(tableName);
    return indexes.some((index) => index.name === indexName);
  } catch {
    return false;
  }
}

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      if (!(await tableExists(queryInterface, TABLE_NAME))) {
        await queryInterface.createTable(
          TABLE_NAME,
          {
            id: {
              type: Sequelize.UUID,
              allowNull: false,
              primaryKey: true,
              defaultValue: Sequelize.literal("gen_random_uuid()"),
            },
            businessId: {
              type: Sequelize.UUID,
              allowNull: false,
            },
            createdByUserId: {
              type: Sequelize.UUID,
              allowNull: false,
            },
            employeeUserId: {
              type: Sequelize.UUID,
              allowNull: true,
            },
            departmentId: {
              type: Sequelize.UUID,
              allowNull: true,
            },
            eventType: {
              type: Sequelize.STRING(50),
              allowNull: false,
              defaultValue: "company_event",
            },
            title: {
              type: Sequelize.STRING(255),
              allowNull: false,
            },
            description: {
              type: Sequelize.TEXT,
              allowNull: true,
            },
            eventDate: {
              type: Sequelize.DATEONLY,
              allowNull: false,
            },
            endDate: {
              type: Sequelize.DATEONLY,
              allowNull: true,
            },
            isRecurring: {
              type: Sequelize.BOOLEAN,
              allowNull: false,
              defaultValue: false,
            },
            visibility: {
              type: Sequelize.STRING(20),
              allowNull: false,
              defaultValue: "all",
            },
            emoji: {
              type: Sequelize.STRING(10),
              allowNull: true,
            },
            color: {
              type: Sequelize.STRING(100),
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
              defaultValue: Sequelize.fn("NOW"),
            },
            updatedAt: {
              type: Sequelize.DATE,
              allowNull: false,
              defaultValue: Sequelize.fn("NOW"),
            },
            deletedAt: {
              type: Sequelize.DATE,
              allowNull: true,
            },
          },
          { transaction },
        );
      } else {
        const columns = await queryInterface.describeTable(TABLE_NAME);

        if (columns.color) {
          await queryInterface.changeColumn(
            TABLE_NAME,
            "color",
            {
              type: Sequelize.STRING(100),
              allowNull: true,
            },
            { transaction },
          );
        }
      }

      const indexes = [
        {
          fields: ["businessId"],
          name: "hr_events_businessId_idx",
        },
        {
          fields: ["eventDate"],
          name: "hr_events_eventDate_idx",
        },
        {
          fields: ["eventType"],
          name: "hr_events_eventType_idx",
        },
      ];

      for (const index of indexes) {
        if (!(await indexExists(queryInterface, TABLE_NAME, index.name))) {
          await queryInterface.addIndex(TABLE_NAME, index.fields, {
            name: index.name,
            transaction,
          });
        }
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      if (await tableExists(queryInterface, TABLE_NAME)) {
        await queryInterface.dropTable(TABLE_NAME, { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
