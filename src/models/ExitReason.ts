import type {
  DataTypes,
  ModelStatic,
  Sequelize,
} from "sequelize";

export type ExitReasonInitiator =
  | "employee"
  | "employer"
  | "both";

export type ExitReasonModel =
  ModelStatic<any> & {
    associate?: (models: any) => void;
  };

export default function defineExitReason(
  sequelize: Sequelize,
  dataTypes: typeof DataTypes,
): ExitReasonModel {
  const ExitReason = sequelize.define(
    "ExitReason",
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

      name: {
        type: dataTypes.STRING(120),
        allowNull: false,
      },

      description: {
        type: dataTypes.TEXT,
        allowNull: true,
      },

      allowedInitiator: {
        type: dataTypes.STRING(20),
        allowNull: false,
        defaultValue: "both",
        validate: {
          isIn: [
            [
              "employee",
              "employer",
              "both",
            ],
          ],
        },
      },

      requiresExplanation: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      isActive: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      sortOrder: {
        type: dataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      createdByUserId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
    },
    {
      tableName: "hr_exit_reasons",
      timestamps: true,
      paranoid: true,

      indexes: [
        {
          fields: [
            "businessId",
            "isActive",
          ],
        },
        {
          fields: [
            "businessId",
            "sortOrder",
          ],
        },
      ],
    },
  ) as ExitReasonModel;

  ExitReason.associate = (models: any) => {
    ExitReason.belongsTo(models.Business, {
      foreignKey: "businessId",
      as: "business",
    });

    ExitReason.belongsTo(models.User, {
      foreignKey: "createdByUserId",
      as: "creator",
    });

    ExitReason.hasMany(models.ExitProcess, {
      foreignKey: "exitReasonId",
      as: "exitProcesses",
    });
  };

  return ExitReason;
}
