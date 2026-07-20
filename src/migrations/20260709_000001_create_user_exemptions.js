"use strict";

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

async function indexExists(
  queryInterface,
  tableName,
  indexName,
) {
  const indexes =
    await queryInterface.showIndex(tableName);

  return indexes.some(
    (index) => index.name === indexName,
  );
}

async function constraintExists(
  queryInterface,
  tableName,
  constraintName,
) {
  const [rows] =
    await queryInterface.sequelize.query(
      `
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = current_schema()
          AND table_name = :tableName
          AND constraint_name = :constraintName
        LIMIT 1
      `,
      {
        replacements: {
          tableName,
          constraintName,
        },
      },
    );

  return rows.length > 0;
}

async function addIndexSafe(
  queryInterface,
  tableName,
  fields,
  name,
  transaction,
) {
  const exists = await indexExists(
    queryInterface,
    tableName,
    name,
  );

  if (exists) {
    return;
  }

  await queryInterface.addIndex(
    tableName,
    fields,
    {
      name,
      transaction,
    },
  );
}

async function addConstraintSafe(
  queryInterface,
  tableName,
  options,
  transaction,
) {
  const exists = await constraintExists(
    queryInterface,
    tableName,
    options.name,
  );

  if (exists) {
    return;
  }

  await queryInterface.addConstraint(
    tableName,
    {
      ...options,
      transaction,
    },
  );
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction =
      await queryInterface.sequelize.transaction();

    try {
      const exists = await tableExists(
        queryInterface,
        "user_exemptions",
      );

      if (!exists) {
        await queryInterface.createTable(
          "user_exemptions",
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
            },

            userId: {
              type: Sequelize.UUID,
              allowNull: false,
            },

            reason: {
              type: Sequelize.TEXT,
              allowNull: false,
            },

            excludeFromPayroll: {
              type: Sequelize.BOOLEAN,
              allowNull: false,
              defaultValue: false,
            },

            status: {
              type: Sequelize.ENUM(
                "PENDING",
                "APPROVED",
                "REJECTED",
              ),
              allowNull: false,
              defaultValue: "PENDING",
            },

            requestedBy: {
              type: Sequelize.UUID,
              allowNull: false,
            },

            approvedBy: {
              type: Sequelize.UUID,
              allowNull: true,
            },

            rejectedBy: {
              type: Sequelize.UUID,
              allowNull: true,
            },

            approvedAt: {
              type: Sequelize.DATE,
              allowNull: true,
            },

            rejectedAt: {
              type: Sequelize.DATE,
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
        "user_exemptions",
        [
          "businessId",
          "userId",
          "status",
        ],
        "user_exemptions_business_user_status_idx",
        transaction,
      );

      await addIndexSafe(
        queryInterface,
        "user_exemptions",
        [
          "businessId",
          "status",
        ],
        "user_exemptions_business_status_idx",
        transaction,
      );

      await addConstraintSafe(
        queryInterface,
        "user_exemptions",
        {
          fields: ["businessId"],
          type: "foreign key",
          name:
            "user_exemptions_businessId_fkey",
          references: {
            table: "businesses",
            field: "id",
          },
          onDelete: "CASCADE",
          onUpdate: "CASCADE",
        },
        transaction,
      );

      const userConstraints = [
        {
          field: "userId",
          onDelete: "CASCADE",
        },
        {
          field: "requestedBy",
          onDelete: "CASCADE",
        },
        {
          field: "approvedBy",
          onDelete: "SET NULL",
        },
        {
          field: "rejectedBy",
          onDelete: "SET NULL",
        },
      ];

      for (const config of userConstraints) {
        await addConstraintSafe(
          queryInterface,
          "user_exemptions",
          {
            fields: [config.field],
            type: "foreign key",
            name:
              `user_exemptions_${config.field}_fkey`,
            references: {
              table: "users",
              field: "id",
            },
            onDelete: config.onDelete,
            onUpdate: "CASCADE",
          },
          transaction,
        );
      }

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
      const exists = await tableExists(
        queryInterface,
        "user_exemptions",
      );

      if (exists) {
        await queryInterface.dropTable(
          "user_exemptions",
          {
            transaction,
          },
        );
      }

      await queryInterface.sequelize.query(
        `
          DROP TYPE IF EXISTS
          "enum_user_exemptions_status";
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
};
