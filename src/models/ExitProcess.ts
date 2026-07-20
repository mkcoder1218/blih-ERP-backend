import type {
  DataTypes,
  ModelStatic,
  Sequelize,
} from "sequelize";

export type ExitInitiatedByType =
  | "employee"
  | "employer";

export type ExitMode =
  | "immediate"
  | "urgent"
  | "standard_notice";

export type ExitFinalPayData = {
  status:
    | "pending"
    | "processing"
    | "settled";

  grossAmount?: number;
  deductions?: number;
  netAmount?: number;

  settledAt?: string;
  settledByUserId?: string;
  notes?: string;
};

export type ExitProcessModel =
  ModelStatic<any> & {
    associate?: (models: any) => void;
  };

export default function defineExitProcess(
  sequelize: Sequelize,
  dataTypes: typeof DataTypes,
): ExitProcessModel {
  const ExitProcess = sequelize.define(
    "ExitProcess",
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

      employeeUserId: {
        type: dataTypes.UUID,
        allowNull: false,
      },

      initiatedByUserId: {
        type: dataTypes.UUID,
        allowNull: false,
      },

      initiatedByType: {
        type: dataTypes.STRING(20),
        allowNull: false,
        defaultValue: "employee",
        validate: {
          isIn: [
            [
              "employee",
              "employer",
            ],
          ],
        },
      },

      /*
       * Existing exit category.
       *
       * Examples:
       * resignation
       * termination
       * redundancy
       */
      exitType: {
        type: dataTypes.STRING(50),
        allowNull: false,
      },

      /*
       * Controls the notice-period behavior.
       *
       * immediate       = 0 days
       * urgent          = 1–29 days
       * standard_notice = 30 days
       */
      exitMode: {
        type: dataTypes.STRING(30),
        allowNull: false,
        defaultValue: "standard_notice",
        validate: {
          isIn: [
            [
              "immediate",
              "urgent",
              "standard_notice",
            ],
          ],
        },
      },

      noticePeriodDays: {
        type: dataTypes.INTEGER,
        allowNull: false,
        defaultValue: 30,
        validate: {
          min: 0,
          max: 30,
        },
      },

      exitReasonId: {
        type: dataTypes.UUID,
        allowNull: true,
      },

      exitReasonNameSnapshot: {
        type: dataTypes.STRING(120),
        allowNull: true,
      },

      reason: {
        type: dataTypes.TEXT,
        allowNull: true,
      },

      letterHtml: {
        type: dataTypes.TEXT,
        allowNull: true,
      },

      /*
       * The approved or requested final
       * working date.
       */
      effectiveDate: {
        type: dataTypes.DATE,
        allowNull: false,
      },

      status: {
        type: dataTypes.STRING(50),
        defaultValue: "pending",
      },

      reviewedByUserId: {
        type: dataTypes.UUID,
        allowNull: true,
      },

      reviewedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },

      leaveStartedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },

      leaveEndsAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },

      offboardingFormSentAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },

      offboardingFormSentByUserId: {
        type: dataTypes.UUID,
        allowNull: true,
      },

      offboardingFormSubmittedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },

      offboardingFormData: {
        type: dataTypes.JSONB,
        defaultValue: {},
      },

      approvalNote: {
        type: dataTypes.TEXT,
        allowNull: true,
      },

      rejectionReason: {
        type: dataTypes.TEXT,
        allowNull: true,
      },

      accountDisabledAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },

      accountDisabledByUserId: {
        type: dataTypes.UUID,
        allowNull: true,
      },

      clearanceData: {
        type: dataTypes.JSONB,
        defaultValue: {},
      },

      finalPayData: {
        type: dataTypes.JSONB,
        defaultValue: {},
      },
    },
    {
      tableName: "hr_exit_processes",
      timestamps: true,
      paranoid: true,
    },
  ) as ExitProcessModel;

  ExitProcess.associate = (models: any) => {
    ExitProcess.belongsTo(models.Business, {
      foreignKey: "businessId",
    });

    ExitProcess.belongsTo(
      models.ExitReason,
      {
        foreignKey: "exitReasonId",
        as: "exitReason",
      },
    );

    if (models.ExitClearanceStep) {
      ExitProcess.hasMany(
        models.ExitClearanceStep,
        {
          foreignKey: "exitProcessId",
          as: "clearanceSteps",
        },
      );
    }

    if (models.ExitInterview) {
      ExitProcess.hasMany(
        models.ExitInterview,
        {
          foreignKey: "exitProcessId",
          as: "exitInterviews",
        },
      );
    }

    if (models.ExitDocument) {
      ExitProcess.hasMany(
        models.ExitDocument,
        {
          foreignKey: "exitProcessId",
          as: "exitDocuments",
        },
      );
    }

    if (models.User) {
      ExitProcess.belongsTo(models.User, {
        foreignKey: "employeeUserId",
        as: "employee",
      });

      ExitProcess.belongsTo(models.User, {
        foreignKey: "initiatedByUserId",
        as: "initiator",
      });

      ExitProcess.belongsTo(models.User, {
        foreignKey: "reviewedByUserId",
        as: "reviewer",
      });

      ExitProcess.belongsTo(models.User, {
        foreignKey:
          "offboardingFormSentByUserId",
        as: "offboardingFormSender",
      });

      ExitProcess.belongsTo(models.User, {
        foreignKey:
          "accountDisabledByUserId",
        as: "accountDisabledBy",
      });
    }
  };

  return ExitProcess;
}
