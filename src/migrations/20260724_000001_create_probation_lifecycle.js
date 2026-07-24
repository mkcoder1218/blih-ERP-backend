"use strict";

const POSITION_COMPETENCIES_TABLE =
  "hr_position_competencies";

const EMPLOYEE_PROBATIONS_TABLE =
  "hr_employee_probations";

const PROBATION_CRITERIA_TABLE =
  "hr_employee_probation_criteria";

const OPEN_PROBATION_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "REVIEW_DUE",
  "MANAGER_REVIEW_PENDING",
  "HR_REVIEW_PENDING",
  "FINAL_APPROVAL_PENDING",
  "CONTRACT_PENDING",
];

async function tableExists(
  queryInterface,
  tableName,
) {
  try {
    await queryInterface.describeTable(
      tableName,
    );

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
  try {
    const indexes =
      await queryInterface.showIndex(
        tableName,
      );

    return indexes.some(
      (index) =>
        index.name === indexName,
    );
  } catch {
    return false;
  }
}

async function removeIndexIfExists(
  queryInterface,
  tableName,
  indexName,
) {
  if (
    await indexExists(
      queryInterface,
      tableName,
      indexName,
    )
  ) {
    await queryInterface.removeIndex(
      tableName,
      indexName,
    );
  }
}

async function dropTableIfExists(
  queryInterface,
  tableName,
) {
  if (
    await tableExists(
      queryInterface,
      tableName,
    )
  ) {
    await queryInterface.dropTable(
      tableName,
    );
  }
}

/** @type {import("sequelize-cli").Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction =
      await queryInterface.sequelize.transaction();

    try {
      if (
        !(await tableExists(
          queryInterface,
          POSITION_COMPETENCIES_TABLE,
        ))
      ) {
        await queryInterface.createTable(
          POSITION_COMPETENCIES_TABLE,
          {
            id: {
              type: Sequelize.UUID,
              allowNull: false,
              primaryKey: true,
              defaultValue:
                Sequelize.literal(
                  "gen_random_uuid()",
                ),
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

            positionId: {
              type: Sequelize.UUID,
              allowNull: false,
              references: {
                model: "positions",
                key: "id",
              },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
            },

            name: {
              type: Sequelize.STRING(160),
              allowNull: false,
            },

            description: {
              type: Sequelize.TEXT,
              allowNull: true,
            },

            weight: {
              type: Sequelize.DECIMAL(
                5,
                2,
              ),
              allowNull: false,
              defaultValue: 0,
            },

            isRequired: {
              type: Sequelize.BOOLEAN,
              allowNull: false,
              defaultValue: true,
            },

            sortOrder: {
              type: Sequelize.INTEGER,
              allowNull: false,
              defaultValue: 0,
            },

            isActive: {
              type: Sequelize.BOOLEAN,
              allowNull: false,
              defaultValue: true,
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

            updatedByUserId: {
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
              defaultValue:
                Sequelize.fn("NOW"),
            },

            updatedAt: {
              type: Sequelize.DATE,
              allowNull: false,
              defaultValue:
                Sequelize.fn("NOW"),
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

      if (
        !(await indexExists(
          queryInterface,
          POSITION_COMPETENCIES_TABLE,
          "hr_position_competencies_business_position_idx",
        ))
      ) {
        await queryInterface.addIndex(
          POSITION_COMPETENCIES_TABLE,
          [
            "businessId",
            "positionId",
          ],
          {
            name: "hr_position_competencies_business_position_idx",
            transaction,
          },
        );
      }

      if (
        !(await indexExists(
          queryInterface,
          POSITION_COMPETENCIES_TABLE,
          "hr_position_competencies_position_active_order_idx",
        ))
      ) {
        await queryInterface.addIndex(
          POSITION_COMPETENCIES_TABLE,
          [
            "positionId",
            "isActive",
            "sortOrder",
          ],
          {
            name: "hr_position_competencies_position_active_order_idx",
            transaction,
          },
        );
      }

      if (
        !(await indexExists(
          queryInterface,
          POSITION_COMPETENCIES_TABLE,
          "hr_position_competencies_position_name_unique",
        ))
      ) {
        await queryInterface.addIndex(
          POSITION_COMPETENCIES_TABLE,
          [
            "positionId",
            "name",
          ],
          {
            name: "hr_position_competencies_position_name_unique",
            unique: true,
            where: {
              deletedAt: null,
            },
            transaction,
          },
        );
      }

      if (
        !(await tableExists(
          queryInterface,
          EMPLOYEE_PROBATIONS_TABLE,
        ))
      ) {
        await queryInterface.createTable(
          EMPLOYEE_PROBATIONS_TABLE,
          {
            id: {
              type: Sequelize.UUID,
              allowNull: false,
              primaryKey: true,
              defaultValue:
                Sequelize.literal(
                  "gen_random_uuid()",
                ),
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

            employeeRecordId: {
              type: Sequelize.UUID,
              allowNull: false,
              references: {
                model:
                  "hr_employee_records",
                key: "id",
              },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
            },

            employeeUserId: {
              type: Sequelize.UUID,
              allowNull: false,
              references: {
                model: "users",
                key: "id",
              },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
            },

            positionId: {
              type: Sequelize.UUID,
              allowNull: false,
              references: {
                model: "positions",
                key: "id",
              },
              onUpdate: "CASCADE",
              onDelete: "RESTRICT",
            },

            departmentId: {
              type: Sequelize.UUID,
              allowNull: false,
              references: {
                model: "departments",
                key: "id",
              },
              onUpdate: "CASCADE",
              onDelete: "RESTRICT",
            },

            managerUserId: {
              type: Sequelize.UUID,
              allowNull: false,
              references: {
                model: "users",
                key: "id",
              },
              onUpdate: "CASCADE",
              onDelete: "RESTRICT",
            },

            finalApproverUserId: {
              type: Sequelize.UUID,
              allowNull: true,
              references: {
                model: "users",
                key: "id",
              },
              onUpdate: "CASCADE",
              onDelete: "SET NULL",
            },

            source: {
              type: Sequelize.ENUM(
                "MANUAL_EMPLOYEE_CREATION",
                "PORTAL_REGISTRATION",
                "EXISTING_EMPLOYEE",
                "PROBATION_EXTENSION",
              ),
              allowNull: false,
            },

            status: {
              type: Sequelize.ENUM(
                "DRAFT",
                "ACTIVE",
                "REVIEW_DUE",
                "MANAGER_REVIEW_PENDING",
                "HR_REVIEW_PENDING",
                "FINAL_APPROVAL_PENDING",
                "CONTRACT_PENDING",
                "CONFIRMED",
                "EXTENDED",
                "TERMINATED",
                "CANCELLED",
              ),
              allowNull: false,
              defaultValue: "ACTIVE",
            },

            startDate: {
              type: Sequelize.DATEONLY,
              allowNull: false,
            },

            expectedEndDate: {
              type: Sequelize.DATEONLY,
              allowNull: false,
            },

            actualEndDate: {
              type: Sequelize.DATEONLY,
              allowNull: true,
            },

            durationMonths: {
              type: Sequelize.INTEGER,
              allowNull: false,
            },

            managerRecommendation: {
              type: Sequelize.ENUM(
                "CONFIRM_EMPLOYMENT",
                "EXTEND_PROBATION",
                "TERMINATE_EMPLOYMENT",
                "REQUEST_MORE_INFORMATION",
              ),
              allowNull: true,
            },

            hrRecommendation: {
              type: Sequelize.ENUM(
                "CONFIRM_EMPLOYMENT",
                "EXTEND_PROBATION",
                "TERMINATE_EMPLOYMENT",
                "REQUEST_MORE_INFORMATION",
              ),
              allowNull: true,
            },

            finalDecision: {
              type: Sequelize.ENUM(
                "CONFIRM_EMPLOYMENT",
                "EXTEND_PROBATION",
                "TERMINATE_EMPLOYMENT",
                "REQUEST_MORE_INFORMATION",
              ),
              allowNull: true,
            },

            finalScore: {
              type: Sequelize.DECIMAL(
                5,
                2,
              ),
              allowNull: true,
            },

            notes: {
              type: Sequelize.TEXT,
              allowNull: true,
            },

            managerReviewSubmittedAt: {
              type: Sequelize.DATE,
              allowNull: true,
            },

            hrReviewSubmittedAt: {
              type: Sequelize.DATE,
              allowNull: true,
            },

            decisionApprovedAt: {
              type: Sequelize.DATE,
              allowNull: true,
            },

            employeeAcknowledgedAt: {
              type: Sequelize.DATE,
              allowNull: true,
            },

            conversionContractId: {
              type: Sequelize.UUID,
              allowNull: true,
            },

            exitProcessId: {
              type: Sequelize.UUID,
              allowNull: true,
              references: {
                model:
                  "hr_exit_processes",
                key: "id",
              },
              onUpdate: "CASCADE",
              onDelete: "SET NULL",
            },

            parentProbationId: {
              type: Sequelize.UUID,
              allowNull: true,
              references: {
                model:
                  EMPLOYEE_PROBATIONS_TABLE,
                key: "id",
              },
              onUpdate: "CASCADE",
              onDelete: "SET NULL",
            },

            createdByUserId: {
              type: Sequelize.UUID,
              allowNull: false,
              references: {
                model: "users",
                key: "id",
              },
              onUpdate: "CASCADE",
              onDelete: "RESTRICT",
            },

            updatedByUserId: {
              type: Sequelize.UUID,
              allowNull: true,
              references: {
                model: "users",
                key: "id",
              },
              onUpdate: "CASCADE",
              onDelete: "SET NULL",
            },

            metadata: {
              type: Sequelize.JSONB,
              allowNull: false,
              defaultValue: {},
            },

            createdAt: {
              type: Sequelize.DATE,
              allowNull: false,
              defaultValue:
                Sequelize.fn("NOW"),
            },

            updatedAt: {
              type: Sequelize.DATE,
              allowNull: false,
              defaultValue:
                Sequelize.fn("NOW"),
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

      if (
        !(await indexExists(
          queryInterface,
          EMPLOYEE_PROBATIONS_TABLE,
          "hr_employee_probations_business_status_idx",
        ))
      ) {
        await queryInterface.addIndex(
          EMPLOYEE_PROBATIONS_TABLE,
          ["businessId", "status"],
          {
            name: "hr_employee_probations_business_status_idx",
            transaction,
          },
        );
      }

      if (
        !(await indexExists(
          queryInterface,
          EMPLOYEE_PROBATIONS_TABLE,
          "hr_employee_probations_business_end_date_idx",
        ))
      ) {
        await queryInterface.addIndex(
          EMPLOYEE_PROBATIONS_TABLE,
          [
            "businessId",
            "expectedEndDate",
          ],
          {
            name: "hr_employee_probations_business_end_date_idx",
            transaction,
          },
        );
      }

      if (
        !(await indexExists(
          queryInterface,
          EMPLOYEE_PROBATIONS_TABLE,
          "hr_employee_probations_employee_status_idx",
        ))
      ) {
        await queryInterface.addIndex(
          EMPLOYEE_PROBATIONS_TABLE,
          [
            "employeeUserId",
            "status",
          ],
          {
            name: "hr_employee_probations_employee_status_idx",
            transaction,
          },
        );
      }

      if (
        !(await indexExists(
          queryInterface,
          EMPLOYEE_PROBATIONS_TABLE,
          "hr_employee_probations_manager_status_idx",
        ))
      ) {
        await queryInterface.addIndex(
          EMPLOYEE_PROBATIONS_TABLE,
          [
            "managerUserId",
            "status",
          ],
          {
            name: "hr_employee_probations_manager_status_idx",
            transaction,
          },
        );
      }

      await queryInterface.sequelize.query(
        `
          CREATE UNIQUE INDEX IF NOT EXISTS
            "hr_employee_probations_one_open_per_employee"
          ON "${EMPLOYEE_PROBATIONS_TABLE}"
            ("businessId", "employeeUserId")
          WHERE
            "deletedAt" IS NULL
            AND "status" IN (
              ${OPEN_PROBATION_STATUSES.map(
                (status) => `'${status}'`,
              ).join(", ")}
            );
        `,
        {
          transaction,
        },
      );

      if (
        !(await tableExists(
          queryInterface,
          PROBATION_CRITERIA_TABLE,
        ))
      ) {
        await queryInterface.createTable(
          PROBATION_CRITERIA_TABLE,
          {
            id: {
              type: Sequelize.UUID,
              allowNull: false,
              primaryKey: true,
              defaultValue:
                Sequelize.literal(
                  "gen_random_uuid()",
                ),
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

            probationId: {
              type: Sequelize.UUID,
              allowNull: false,
              references: {
                model:
                  EMPLOYEE_PROBATIONS_TABLE,
                key: "id",
              },
              onUpdate: "CASCADE",
              onDelete: "CASCADE",
            },

            sourcePositionCompetencyId: {
              type: Sequelize.UUID,
              allowNull: true,
              references: {
                model:
                  POSITION_COMPETENCIES_TABLE,
                key: "id",
              },
              onUpdate: "CASCADE",
              onDelete: "SET NULL",
            },

            name: {
              type: Sequelize.STRING(160),
              allowNull: false,
            },

            description: {
              type: Sequelize.TEXT,
              allowNull: true,
            },

            weight: {
              type: Sequelize.DECIMAL(
                5,
                2,
              ),
              allowNull: false,
            },

            isRequired: {
              type: Sequelize.BOOLEAN,
              allowNull: false,
              defaultValue: true,
            },

            sortOrder: {
              type: Sequelize.INTEGER,
              allowNull: false,
              defaultValue: 0,
            },

            managerScore: {
              type: Sequelize.DECIMAL(
                5,
                2,
              ),
              allowNull: true,
            },

            managerComment: {
              type: Sequelize.TEXT,
              allowNull: true,
            },

            hrScore: {
              type: Sequelize.DECIMAL(
                5,
                2,
              ),
              allowNull: true,
            },

            hrComment: {
              type: Sequelize.TEXT,
              allowNull: true,
            },

            finalScore: {
              type: Sequelize.DECIMAL(
                5,
                2,
              ),
              allowNull: true,
            },

            createdAt: {
              type: Sequelize.DATE,
              allowNull: false,
              defaultValue:
                Sequelize.fn("NOW"),
            },

            updatedAt: {
              type: Sequelize.DATE,
              allowNull: false,
              defaultValue:
                Sequelize.fn("NOW"),
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

      if (
        !(await indexExists(
          queryInterface,
          PROBATION_CRITERIA_TABLE,
          "hr_employee_probation_criteria_business_probation_idx",
        ))
      ) {
        await queryInterface.addIndex(
          PROBATION_CRITERIA_TABLE,
          [
            "businessId",
            "probationId",
          ],
          {
            name: "hr_employee_probation_criteria_business_probation_idx",
            transaction,
          },
        );
      }

      if (
        !(await indexExists(
          queryInterface,
          PROBATION_CRITERIA_TABLE,
          "hr_employee_probation_criteria_probation_name_unique",
        ))
      ) {
        await queryInterface.addIndex(
          PROBATION_CRITERIA_TABLE,
          ["probationId", "name"],
          {
            name: "hr_employee_probation_criteria_probation_name_unique",
            unique: true,
            where: {
              deletedAt: null,
            },
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

  async down(queryInterface) {
    const transaction =
      await queryInterface.sequelize.transaction();

    try {
      await removeIndexIfExists(
        queryInterface,
        PROBATION_CRITERIA_TABLE,
        "hr_employee_probation_criteria_probation_name_unique",
      );

      await removeIndexIfExists(
        queryInterface,
        PROBATION_CRITERIA_TABLE,
        "hr_employee_probation_criteria_business_probation_idx",
      );

      await dropTableIfExists(
        queryInterface,
        PROBATION_CRITERIA_TABLE,
      );

      await removeIndexIfExists(
        queryInterface,
        EMPLOYEE_PROBATIONS_TABLE,
        "hr_employee_probations_one_open_per_employee",
      );

      await removeIndexIfExists(
        queryInterface,
        EMPLOYEE_PROBATIONS_TABLE,
        "hr_employee_probations_manager_status_idx",
      );

      await removeIndexIfExists(
        queryInterface,
        EMPLOYEE_PROBATIONS_TABLE,
        "hr_employee_probations_employee_status_idx",
      );

      await removeIndexIfExists(
        queryInterface,
        EMPLOYEE_PROBATIONS_TABLE,
        "hr_employee_probations_business_end_date_idx",
      );

      await removeIndexIfExists(
        queryInterface,
        EMPLOYEE_PROBATIONS_TABLE,
        "hr_employee_probations_business_status_idx",
      );

      await dropTableIfExists(
        queryInterface,
        EMPLOYEE_PROBATIONS_TABLE,
      );

      await removeIndexIfExists(
        queryInterface,
        POSITION_COMPETENCIES_TABLE,
        "hr_position_competencies_position_name_unique",
      );

      await removeIndexIfExists(
        queryInterface,
        POSITION_COMPETENCIES_TABLE,
        "hr_position_competencies_position_active_order_idx",
      );

      await removeIndexIfExists(
        queryInterface,
        POSITION_COMPETENCIES_TABLE,
        "hr_position_competencies_business_position_idx",
      );

      await dropTableIfExists(
        queryInterface,
        POSITION_COMPETENCIES_TABLE,
      );

      await queryInterface.sequelize.query(
        `
          DROP TYPE IF EXISTS
            "enum_hr_employee_probations_source";
        `,
        {
          transaction,
        },
      );

      await queryInterface.sequelize.query(
        `
          DROP TYPE IF EXISTS
            "enum_hr_employee_probations_status";
        `,
        {
          transaction,
        },
      );

      await queryInterface.sequelize.query(
        `
          DROP TYPE IF EXISTS
            "enum_hr_employee_probations_managerRecommendation";
        `,
        {
          transaction,
        },
      );

      await queryInterface.sequelize.query(
        `
          DROP TYPE IF EXISTS
            "enum_hr_employee_probations_hrRecommendation";
        `,
        {
          transaction,
        },
      );

      await queryInterface.sequelize.query(
        `
          DROP TYPE IF EXISTS
            "enum_hr_employee_probations_finalDecision";
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
