import type {
  DataTypes,
  ModelStatic,
  Sequelize,
} from "sequelize";

export type EmployeeProbationCriterionModel =
  ModelStatic<any> & {
    associate?: (models: any) => void;
  };

export default (
  sequelize: Sequelize,
  dataTypes: typeof DataTypes,
): EmployeeProbationCriterionModel => {
  const EmployeeProbationCriterion =
    sequelize.define(
      "EmployeeProbationCriterion",
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

        probationId: {
          type: dataTypes.UUID,
          allowNull: false,
        },

        sourcePositionCompetencyId: {
          type: dataTypes.UUID,
          allowNull: true,
        },

        name: {
          type: dataTypes.STRING(160),
          allowNull: false,
        },

        description: {
          type: dataTypes.TEXT,
          allowNull: true,
        },

        weight: {
          type: dataTypes.DECIMAL(5, 2),
          allowNull: false,
        },

        isRequired: {
          type: dataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },

        sortOrder: {
          type: dataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },

        managerScore: {
          type: dataTypes.DECIMAL(5, 2),
          allowNull: true,
        },

        managerComment: {
          type: dataTypes.TEXT,
          allowNull: true,
        },

        hrScore: {
          type: dataTypes.DECIMAL(5, 2),
          allowNull: true,
        },

        hrComment: {
          type: dataTypes.TEXT,
          allowNull: true,
        },

        finalScore: {
          type: dataTypes.DECIMAL(5, 2),
          allowNull: true,
        },
      },
      {
        tableName:
          "hr_employee_probation_criteria",
        timestamps: true,
        paranoid: true,
        indexes: [
          {
            fields: [
              "businessId",
              "probationId",
            ],
          },
          {
            unique: true,
            fields: ["probationId", "name"],
          },
        ],
      },
    ) as EmployeeProbationCriterionModel;

  EmployeeProbationCriterion.associate = (
    models: any,
  ) => {
    EmployeeProbationCriterion.belongsTo(
      models.Business,
      {
        foreignKey: "businessId",
        as: "business",
      },
    );

    EmployeeProbationCriterion.belongsTo(
      models.EmployeeProbation,
      {
        foreignKey: "probationId",
        as: "probation",
      },
    );

    EmployeeProbationCriterion.belongsTo(
      models.PositionCompetency,
      {
        foreignKey:
          "sourcePositionCompetencyId",
        as: "sourceCompetency",
      },
    );
  };

  return EmployeeProbationCriterion;
};
