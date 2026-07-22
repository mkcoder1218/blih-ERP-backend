"use strict";

/**
 * Check whether a table exists using the same transaction as the migration.
 *
 * This matters because PostgreSQL does not expose uncommitted DDL changes
 * to another connection. Every schema operation in this migration must use
 * the same transaction.
 */
async function tableExists(
  queryInterface,
  tableName,
  transaction,
) {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT to_regclass(:tableName) AS "tableName";
    `,
    {
      replacements: {
        tableName: `public.${tableName}`,
      },
      transaction,
    },
  );

  return Boolean(rows?.[0]?.tableName);
}

async function getTableDefinition(
  queryInterface,
  tableName,
  transaction,
) {
  return queryInterface.describeTable(tableName, {
    transaction,
  });
}

async function addColumnSafe(
  queryInterface,
  tableName,
  columnName,
  definition,
  transaction,
) {
  const table = await getTableDefinition(
    queryInterface,
    tableName,
    transaction,
  );

  if (table[columnName]) {
    return;
  }

  await queryInterface.addColumn(
    tableName,
    columnName,
    definition,
    {
      transaction,
    },
  );
}

async function removeColumnSafe(
  queryInterface,
  tableName,
  columnName,
  transaction,
) {
  const exists = await tableExists(
    queryInterface,
    tableName,
    transaction,
  );

  if (!exists) {
    return;
  }

  const table = await getTableDefinition(
    queryInterface,
    tableName,
    transaction,
  );

  if (!table[columnName]) {
    return;
  }

  await queryInterface.removeColumn(
    tableName,
    columnName,
    {
      transaction,
    },
  );
}

async function indexExists(
  queryInterface,
  indexName,
  transaction,
) {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = :indexName
      LIMIT 1;
    `,
    {
      replacements: {
        indexName,
      },
      transaction,
    },
  );

  return rows.length > 0;
}

async function addIndexSafe(
  queryInterface,
  tableName,
  fields,
  indexName,
  transaction,
) {
  const exists = await indexExists(
    queryInterface,
    indexName,
    transaction,
  );

  if (exists) {
    return;
  }

  await queryInterface.addIndex(
    tableName,
    fields,
    {
      name: indexName,
      transaction,
    },
  );
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction =
      await queryInterface.sequelize.transaction();

    try {
      const exitProcessesExist =
        await tableExists(
          queryInterface,
          "hr_exit_processes",
          transaction,
        );

      if (!exitProcessesExist) {
        throw new Error(
          'Required table "hr_exit_processes" does not exist. ' +
            "Run the earlier exit/offboarding migrations first.",
        );
      }

      const exitReasonsExist =
        await tableExists(
          queryInterface,
          "hr_exit_reasons",
          transaction,
        );

      if (!exitReasonsExist) {
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
          {
            transaction,
          },
        );
      }

      await addIndexSafe(
        queryInterface,
        "hr_exit_reasons",
        ["businessId", "isActive"],
        "hr_exit_reasons_business_active_idx",
        transaction,
      );

      await addIndexSafe(
        queryInterface,
        "hr_exit_reasons",
        ["businessId", "sortOrder"],
        "hr_exit_reasons_business_sort_idx",
        transaction,
      );

      await addColumnSafe(
        queryInterface,
        "hr_exit_processes",
        "initiatedByType",
        {
          type: Sequelize.STRING(20),
          allowNull: false,
          defaultValue: "employee",
        },
        transaction,
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
        transaction,
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
        transaction,
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
        transaction,
      );

      await addColumnSafe(
        queryInterface,
        "hr_exit_processes",
        "exitReasonNameSnapshot",
        {
          type: Sequelize.STRING(120),
          allowNull: true,
        },
        transaction,
      );

      await addColumnSafe(
        queryInterface,
        "hr_exit_processes",
        "letterHtml",
        {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        transaction,
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
            );
        `,
        {
          transaction,
        },
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
          transaction,
        );
      }

      const exitReasonsExist =
        await tableExists(
          queryInterface,
          "hr_exit_reasons",
          transaction,
        );

      if (exitReasonsExist) {
        await queryInterface.dropTable(
          "hr_exit_reasons",
          {
            transaction,
          },
        );
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
