"use strict";

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

async function addColumnSafe(
  queryInterface,
  tableName,
  columnName,
  definition,
) {
  const table = await queryInterface.describeTable(tableName);

  if (!table[columnName]) {
    await queryInterface.addColumn(
      tableName,
      columnName,
      definition,
    );
  }
}

async function removeColumnSafe(
  queryInterface,
  tableName,
  columnName,
) {
  const table = await queryInterface.describeTable(tableName);

  if (table[columnName]) {
    await queryInterface.removeColumn(
      tableName,
      columnName,
    );
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction =
      await queryInterface.sequelize.transaction();

    try {
      const hasExitReasons =
        await tableExists(
          queryInterface,
          "hr_exit_reasons",
        );

      if (!hasExitReasons) {
        await queryInterface.createTable(
          "hr_exit_reasons",
          {
            id: {
              type: Sequelize.UUID,
              defaultValue: Sequelize.UUIDV4,
              primaryKey: true,
              allowNull: false,
            },

            businessId: {
              type: Sequelize.UUID,
              allowNull: false,
              references: {
                model: "businesses",
                key: "id",
              },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
            },

            name: {
              type: Sequelize.STRING(120),
              allowNull: false,
            },

            description: {
              type: Sequelize.TEXT,
              allowNull: true,
            },

            allowedInitiator: {
              type: Sequelize.STRING(20),
              allowNull: false,
              defaultValue: "both",
            },

            requiresExplanation: {
              type: Sequelize.BOOLEAN,
              allowNull: false,
              defaultValue: true,
            },

            isActive: {
              type: Sequelize.BOOLEAN,
              allowNull: false,
              defaultValue: true,
            },

            sortOrder: {
              type: Sequelize.INTEGER,
              allowNull: false,
              defaultValue: 0,
            },

            createdByUserId: {
              type: Sequelize.UUID,
              allowNull: true,
              references: {
                model: "users",
                key: "id",
              },
              onUpdate: "CASCADE",
              onDelete: "SET NULL",
            },

            createdAt: {
              type: Sequelize.DATE,
              allowNull: false,
            },

            updatedAt: {
              type: Sequelize.DATE,
              allowNull: false,
            },

            deletedAt: {
              type: Sequelize.DATE,
              allowNull: true,
            },
          },
          { transaction },
        );

        await queryInterface.addIndex(
          "hr_exit_reasons",
          ["businessId", "isActive"],
          {
            name:
              "hr_exit_reasons_business_active_idx",
            transaction,
          },
        );

        await queryInterface.addIndex(
          "hr_exit_reasons",
          ["businessId", "sortOrder"],
          {
            name:
              "hr_exit_reasons_business_sort_idx",
            transaction,
          },
        );
      }

      await addColumnSafe(
        queryInterface,
        "hr_exit_processes",
        "initiatedByType",
        {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: "employee",
        },
      );

      await addColumnSafe(
        queryInterface,
        "hr_exit_processes",
        "exitMode",
        {
          type: Sequelize.STRING(30),
          allowNull: false,
          defaultValue: "standard_notice",
        },
      );

      await addColumnSafe(
        queryInterface,
        "hr_exit_processes",
        "noticePeriodDays",
        {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 30,
        },
      );

      await addColumnSafe(
        queryInterface,
        "hr_exit_processes",
        "exitReasonId",
        {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: "hr_exit_reasons",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
      );

      await addColumnSafe(
        queryInterface,
        "hr_exit_processes",
        "exitReasonNameSnapshot",
        {
          type: Sequelize.STRING(120),
          allowNull: true,
        },
      );

      await addColumnSafe(
        queryInterface,
        "hr_exit_processes",
        "letterHtml",
        {
          type: Sequelize.TEXT,
          allowNull: true,
        },
      );

      await queryInterface.sequelize.query(
        `
          UPDATE "hr_exit_processes"
          SET
            "initiatedByType" = CASE
              WHEN "exitType" = 'resignation'
                THEN 'employee'
              ELSE 'employer'
            END,
            "exitMode" = COALESCE(
              "exitMode",
              'standard_notice'
            ),
            "noticePeriodDays" = COALESCE(
              "noticePeriodDays",
              30
            ),
            "exitReasonNameSnapshot" = COALESCE(
              "exitReasonNameSnapshot",
              "reason"
            )
        `,
        { transaction },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction =
      await queryInterface.sequelize.transaction();

    try {
      for (const column of [
        "letterHtml",
        "exitReasonNameSnapshot",
        "exitReasonId",
        "noticePeriodDays",
        "exitMode",
        "initiatedByType",
      ]) {
        await removeColumnSafe(
          queryInterface,
          "hr_exit_processes",
          column,
        );
      }

      if (
        await tableExists(
          queryInterface,
          "hr_exit_reasons",
        )
      ) {
        await queryInterface.dropTable(
          "hr_exit_reasons",
          { transaction },
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
