import type {
  DataTypes,
  ModelStatic,
  Sequelize,
} from "sequelize";

export const EMPLOYEE_PROBATION_STATUSES = [
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
] as const;

export const EMPLOYEE_PROBATION_SOURCES = [
  "MANUAL_EMPLOYEE_CREATION",
  "PORTAL_REGISTRATION",
  "EXISTING_EMPLOYEE",
  "PROBATION_EXTENSION",
] as const;

export const EMPLOYEE_PROBATION_DECISIONS = [
  "CONFIRM_EMPLOYMENT",
  "EXTEND_PROBATION",
  "TERMINATE_EMPLOYMENT",
  "REQUEST_MORE_INFORMATION",
] as const;

export type EmployeeProbationStatus =
  (typeof EMPLOYEE_PROBATION_STATUSES)[number];

export type EmployeeProbationSource =
  (typeof EMPLOYEE_PROBATION_SOURCES)[number];

export type EmployeeProbationDecision =
  (typeof EMPLOYEE_PROBATION_DECISIONS)[number];

export type EmployeeProbationModel =
  ModelStatic<any> & {
    associate?: (models: any) => void;
  };

export default (
  sequelize: Sequelize,
  dataTypes: typeof DataTypes,
): EmployeeProbationModel => {
  const EmployeeProbation = sequelize.define(
    "EmployeeProbation",
    {
      id: {
        type: dataTypes.UUID,
        defaultValue: dataTypes.UUIDV4,
        primaryKey: true,
      },

      businessId: {
        type: dataTypes.UUID,
        allowNull: false,
      },

      employeeRecordId: {
        type: dataTypes.UUID,
        allowNull: false,
      },

      employeeUserId: {
        type: dataTypes.UUID,
        allowNull: false,
      },

      positionId: {
        type: dataTypes.UUID,
        allowNull: false,
      },

      departmentId: {
        type: dataTypes.UUID,
        allowNull: false,
      },

      managerUserId: {
        type: dataTypes.UUID,
        allowNull: false,
      },

      finalApproverUserId: {
        type: dataTypes.UUID,
        allowNull: true,
      },

      source: {
        type: dataTypes.ENUM(
          ...EMPLOYEE_PROBATION_SOURCES,
        ),
        allowNull: false,
      },

      status: {
        type: dataTypes.ENUM(
          ...EMPLOYEE_PROBATION_STATUSES,
        ),
        allowNull: false,
        defaultValue: "ACTIVE",
      },

      startDate: {
        type: dataTypes.DATEONLY,
        allowNull: false,
      },

      expectedEndDate: {
        type: dataTypes.DATEONLY,
        allowNull: false,
      },

      actualEndDate: {
        type: dataTypes.DATEONLY,
        allowNull: true,
      },

      durationMonths: {
        type: dataTypes.INTEGER,
        allowNull: false,
      },

      managerRecommendation: {
        type: dataTypes.ENUM(
          ...EMPLOYEE_PROBATION_DECISIONS,
        ),
        allowNull: true,
      },

      hrRecommendation: {
        type: dataTypes.ENUM(
          ...EMPLOYEE_PROBATION_DECISIONS,
        ),
        allowNull: true,
      },

      finalDecision: {
        type: dataTypes.ENUM(
          ...EMPLOYEE_PROBATION_DECISIONS,
        ),
        allowNull: true,
      },

      finalScore: {
        type: dataTypes.DECIMAL(5, 2),
        allowNull: true,
      },

      notes: {
        type: dataTypes.TEXT,
        allowNull: true,
      },

      managerReviewSubmittedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },

      hrReviewSubmittedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },

      decisionApprovedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },

      employeeAcknowledgedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },

      conversionContractId: {
        type: dataTypes.UUID,
        allowNull: true,
      },

      exitProcessId: {
        type: dataTypes.UUID,
        allowNull: true,
      },

      parentProbationId: {
        type: dataTypes.UUID,
        allowNull: true,
      },

      createdByUserId: {
        type: dataTypes.UUID,
        allowNull: false,
      },

      updatedByUserId: {
        type: dataTypes.UUID,
        allowNull: true,
      },

      metadata: {
        type: dataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
    },
    {
      tableName: "hr_employee_probations",
      timestamps: true,
      paranoid: true,
      indexes: [
        {
          fields: ["businessId", "status"],
        },
        {
          fields: [
            "businessId",
            "expectedEndDate",
          ],
        },
        {
          fields: [
            "employeeUserId",
            "status",
          ],
        },
        {
          fields: [
            "managerUserId",
            "status",
          ],
        },
      ],
    },
  ) as EmployeeProbationModel;

  EmployeeProbation.associate = (
    models: any,
  ) => {
    EmployeeProbation.belongsTo(
      models.Business,
      {
        foreignKey: "businessId",
        as: "business",
      },
    );

    EmployeeProbation.belongsTo(
      models.EmployeeRecord,
      {
        foreignKey: "employeeRecordId",
        as: "employeeRecord",
      },
    );

    EmployeeProbation.belongsTo(
      models.User,
      {
        foreignKey: "employeeUserId",
        as: "employee",
      },
    );

    EmployeeProbation.belongsTo(
      models.User,
      {
        foreignKey: "managerUserId",
        as: "manager",
      },
    );

    EmployeeProbation.belongsTo(
      models.User,
      {
        foreignKey: "finalApproverUserId",
        as: "finalApprover",
      },
    );

    EmployeeProbation.belongsTo(
      models.User,
      {
        foreignKey: "createdByUserId",
        as: "createdBy",
      },
    );

    EmployeeProbation.belongsTo(
      models.User,
      {
        foreignKey: "updatedByUserId",
        as: "updatedBy",
      },
    );

    EmployeeProbation.belongsTo(
      models.Position,
      {
        foreignKey: "positionId",
        as: "position",
      },
    );

    EmployeeProbation.belongsTo(
      models.Department,
      {
        foreignKey: "departmentId",
        as: "department",
      },
    );

    if (models.EmploymentContract) {
      EmployeeProbation.belongsTo(
        models.EmploymentContract,
        {
          foreignKey: "conversionContractId",
          as: "conversionContract",
        },
      );
    }

    if (models.ExitProcess) {
      EmployeeProbation.belongsTo(
        models.ExitProcess,
        {
          foreignKey: "exitProcessId",
          as: "exitProcess",
        },
      );
    }

    EmployeeProbation.belongsTo(
      models.EmployeeProbation,
      {
        foreignKey: "parentProbationId",
        as: "parentProbation",
      },
    );

    EmployeeProbation.hasMany(
      models.EmployeeProbation,
      {
        foreignKey: "parentProbationId",
        as: "extensions",
      },
    );

    EmployeeProbation.hasMany(
      models.EmployeeProbationCriterion,
      {
        foreignKey: "probationId",
        as: "criteria",
      },
    );
  };

  return EmployeeProbation;
};
