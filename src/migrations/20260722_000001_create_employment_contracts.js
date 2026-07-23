"use strict";

async function tableExists(
  queryInterface,
  tableName,
  transaction,
) {
  const [rows] =
    await queryInterface.sequelize.query(
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

async function columnExists(
  queryInterface,
  tableName,
  columnName,
  transaction,
) {
  const table = await queryInterface.describeTable(
    tableName,
    {
      transaction,
    },
  );

  return Boolean(table[columnName]);
}

async function indexExists(
  queryInterface,
  indexName,
  transaction,
) {
  const [rows] =
    await queryInterface.sequelize.query(
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
  name,
  transaction,
  options = {},
) {
  const exists = await indexExists(
    queryInterface,
    name,
    transaction,
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
      ...options,
    },
  );
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction =
      await queryInterface.sequelize.transaction();

    try {
      const templatesExist = await tableExists(
        queryInterface,
        "employment_contract_templates",
        transaction,
      );

      if (!templatesExist) {
        await queryInterface.createTable(
          "employment_contract_templates",
          {
            id: {
              type: Sequelize.UUID,
              defaultValue: Sequelize.UUIDV4,
              allowNull: false,
              primaryKey: true,
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
              type: Sequelize.STRING(160),
              allowNull: false,
            },

            description: {
              type: Sequelize.TEXT,
              allowNull: true,
            },

            contractType: {
              type: Sequelize.STRING(80),
              allowNull: false,
              defaultValue: "PERMANENT",
            },

            subject: {
              type: Sequelize.STRING(255),
              allowNull: false,
            },

            bodyHtml: {
              type: Sequelize.TEXT,
              allowNull: false,
            },

            bodyText: {
              type: Sequelize.TEXT,
              allowNull: false,
              defaultValue: "",
            },

            variables: {
              type: Sequelize.JSONB,
              allowNull: false,
              defaultValue: [],
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

            createdById: {
              type: Sequelize.UUID,
              allowNull: true,
              references: {
                model: "users",
                key: "id",
              },
              onUpdate: "CASCADE",
              onDelete: "SET NULL",
            },

            updatedById: {
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
          },
          {
            transaction,
          },
        );
      }

      await addIndexSafe(
        queryInterface,
        "employment_contract_templates",
        ["businessId"],
        "employment_contract_templates_business_id_idx",
        transaction,
      );

      await addIndexSafe(
        queryInterface,
        "employment_contract_templates",
        ["businessId", "isActive"],
        "employment_contract_templates_business_active_idx",
        transaction,
      );

      await addIndexSafe(
        queryInterface,
        "employment_contract_templates",
        ["businessId", "contractType"],
        "employment_contract_templates_business_type_idx",
        transaction,
      );

      const contractsExist = await tableExists(
        queryInterface,
        "employment_contracts",
        transaction,
      );

      if (!contractsExist) {
        await queryInterface.createTable(
          "employment_contracts",
          {
            id: {
              type: Sequelize.UUID,
              defaultValue: Sequelize.UUIDV4,
              allowNull: false,
              primaryKey: true,
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

            contractNumber: {
              type: Sequelize.STRING(80),
              allowNull: false,
            },

            templateId: {
              type: Sequelize.UUID,
              allowNull: true,
              references: {
                model: "employment_contract_templates",
                key: "id",
              },
              onUpdate: "CASCADE",
              onDelete: "SET NULL",
            },

            offerId: {
              type: Sequelize.UUID,
              allowNull: true,
              references: {
                model: "offer_letters",
                key: "id",
              },
              onUpdate: "CASCADE",
              onDelete: "SET NULL",
            },

            candidateOnboardingId: {
              type: Sequelize.UUID,
              allowNull: true,
              references: {
                model: "candidate_onboardings",
                key: "id",
              },
              onUpdate: "CASCADE",
              onDelete: "SET NULL",
            },

            employeeRecordId: {
              type: Sequelize.UUID,
              allowNull: true,
              references: {
                model: "employee_records",
                key: "id",
              },
              onUpdate: "CASCADE",
              onDelete: "SET NULL",
            },

            candidateName: {
              type: Sequelize.STRING(180),
              allowNull: false,
            },

            candidateEmail: {
              type: Sequelize.STRING(255),
              allowNull: false,
            },

            candidatePhone: {
              type: Sequelize.STRING(60),
              allowNull: true,
            },

            departmentId: {
              type: Sequelize.UUID,
              allowNull: true,
              references: {
                model: "departments",
                key: "id",
              },
              onUpdate: "CASCADE",
              onDelete: "SET NULL",
            },

            positionId: {
              type: Sequelize.UUID,
              allowNull: true,
              references: {
                model: "positions",
                key: "id",
              },
              onUpdate: "CASCADE",
              onDelete: "SET NULL",
            },

            reportingManagerId: {
              type: Sequelize.UUID,
              allowNull: true,
              references: {
                model: "users",
                key: "id",
              },
              onUpdate: "CASCADE",
              onDelete: "SET NULL",
            },

            contractType: {
              type: Sequelize.STRING(80),
              allowNull: false,
              defaultValue: "PERMANENT",
            },

            employmentType: {
              type: Sequelize.STRING(80),
              allowNull: true,
            },

            workLocation: {
              type: Sequelize.STRING(255),
              allowNull: true,
            },

            salary: {
              type: Sequelize.DECIMAL(18, 2),
              allowNull: true,
            },

            currency: {
              type: Sequelize.STRING(10),
              allowNull: false,
              defaultValue: "ETB",
            },

            startDate: {
              type: Sequelize.DATEONLY,
              allowNull: true,
            },

            endDate: {
              type: Sequelize.DATEONLY,
              allowNull: true,
            },

            probationStartDate: {
              type: Sequelize.DATEONLY,
              allowNull: true,
            },

            probationEndDate: {
              type: Sequelize.DATEONLY,
              allowNull: true,
            },

            noticePeriodDays: {
              type: Sequelize.INTEGER,
              allowNull: true,
            },

            subject: {
              type: Sequelize.STRING(255),
              allowNull: false,
            },

            bodyHtml: {
              type: Sequelize.TEXT,
              allowNull: false,
            },

            bodyText: {
              type: Sequelize.TEXT,
              allowNull: false,
              defaultValue: "",
            },

            renderedSubject: {
              type: Sequelize.STRING(255),
              allowNull: true,
            },

            renderedHtml: {
              type: Sequelize.TEXT,
              allowNull: true,
            },

            renderedText: {
              type: Sequelize.TEXT,
              allowNull: true,
            },

            status: {
              type: Sequelize.STRING(40),
              allowNull: false,
              defaultValue: "DRAFT",
            },

            pdfPath: {
              type: Sequelize.STRING(1000),
              allowNull: true,
            },

            pdfUrl: {
              type: Sequelize.STRING(1000),
              allowNull: true,
            },

            sentAt: {
              type: Sequelize.DATE,
              allowNull: true,
            },

            viewedAt: {
              type: Sequelize.DATE,
              allowNull: true,
            },

            employeeSignedAt: {
              type: Sequelize.DATE,
              allowNull: true,
            },

            employerSignedAt: {
              type: Sequelize.DATE,
              allowNull: true,
            },

            activatedAt: {
              type: Sequelize.DATE,
              allowNull: true,
            },

            terminatedAt: {
              type: Sequelize.DATE,
              allowNull: true,
            },

            terminationReason: {
              type: Sequelize.TEXT,
              allowNull: true,
            },

            metadata: {
              type: Sequelize.JSONB,
              allowNull: false,
              defaultValue: {},
            },

            createdById: {
              type: Sequelize.UUID,
              allowNull: true,
              references: {
                model: "users",
                key: "id",
              },
              onUpdate: "CASCADE",
              onDelete: "SET NULL",
            },

            updatedById: {
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
        "employment_contracts",
        ["businessId"],
        "employment_contracts_business_id_idx",
        transaction,
      );

      await addIndexSafe(
        queryInterface,
        "employment_contracts",
        ["businessId", "status"],
        "employment_contracts_business_status_idx",
        transaction,
      );

      await addIndexSafe(
        queryInterface,
        "employment_contracts",
        ["businessId", "candidateEmail"],
        "employment_contracts_business_candidate_email_idx",
        transaction,
      );

      await addIndexSafe(
        queryInterface,
        "employment_contracts",
        ["businessId", "contractNumber"],
        "employment_contracts_business_contract_number_unique",
        transaction,
        {
          unique: true,
        },
      );

      await addIndexSafe(
        queryInterface,
        "employment_contracts",
        ["offerId"],
        "employment_contracts_offer_id_idx",
        transaction,
      );

      await addIndexSafe(
        queryInterface,
        "employment_contracts",
        ["candidateOnboardingId"],
        "employment_contracts_onboarding_id_idx",
        transaction,
      );

      await addIndexSafe(
        queryInterface,
        "employment_contracts",
        ["employeeRecordId"],
        "employment_contracts_employee_record_id_idx",
        transaction,
      );

      const onboardingExists = await tableExists(
        queryInterface,
        "candidate_onboardings",
        transaction,
      );

      if (onboardingExists) {
        const hasContractId = await columnExists(
          queryInterface,
          "candidate_onboardings",
          "contractId",
          transaction,
        );

        if (!hasContractId) {
          await queryInterface.addColumn(
            "candidate_onboardings",
            "contractId",
            {
              type: Sequelize.UUID,
              allowNull: true,
              references: {
                model: "employment_contracts",
                key: "id",
              },
              onUpdate: "CASCADE",
              onDelete: "SET NULL",
            },
            {
              transaction,
            },
          );
        }

        await addIndexSafe(
          queryInterface,
          "candidate_onboardings",
          ["contractId"],
          "candidate_onboardings_contract_id_idx",
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
      const onboardingExists = await tableExists(
        queryInterface,
        "candidate_onboardings",
        transaction,
      );

      if (onboardingExists) {
        const hasContractId = await columnExists(
          queryInterface,
          "candidate_onboardings",
          "contractId",
          transaction,
        );

        if (hasContractId) {
          await queryInterface.removeColumn(
            "candidate_onboardings",
            "contractId",
            {
              transaction,
            },
          );
        }
      }

      const contractsExist = await tableExists(
        queryInterface,
        "employment_contracts",
        transaction,
      );

      if (contractsExist) {
        await queryInterface.dropTable(
          "employment_contracts",
          {
            transaction,
          },
        );
      }

      const templatesExist = await tableExists(
        queryInterface,
        "employment_contract_templates",
        transaction,
      );

      if (templatesExist) {
        await queryInterface.dropTable(
          "employment_contract_templates",
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
