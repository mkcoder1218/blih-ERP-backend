import type {
  DataTypes,
  ModelStatic,
  Sequelize,
} from "sequelize";

export type PositionCompetencyModel =
  ModelStatic<any> & {
    associate?: (models: any) => void;
  };

export default (
  sequelize: Sequelize,
  dataTypes: typeof DataTypes,
): PositionCompetencyModel => {
  const PositionCompetency = sequelize.define(
    "PositionCompetency",
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
      positionId: {
        type: dataTypes.UUID,
        allowNull: false,
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
        defaultValue: 0,
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
      isActive: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdByUserId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      updatedByUserId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
    },
    {
      tableName: "hr_position_competencies",
      timestamps: true,
      paranoid: true,
      indexes: [
        {
          fields: ["businessId", "positionId"],
        },
        {
          fields: [
            "positionId",
            "isActive",
            "sortOrder",
          ],
        },
      ],
    },
  ) as PositionCompetencyModel;

  PositionCompetency.associate = (
    models: any,
  ) => {
    PositionCompetency.belongsTo(
      models.Business,
      {
        foreignKey: "businessId",
        as: "business",
      },
    );

    PositionCompetency.belongsTo(
      models.Position,
      {
        foreignKey: "positionId",
        as: "position",
      },
    );

    if (models.User) {
      PositionCompetency.belongsTo(
        models.User,
        {
          foreignKey: "createdByUserId",
          as: "createdBy",
        },
      );

      PositionCompetency.belongsTo(
        models.User,
        {
          foreignKey: "updatedByUserId",
          as: "updatedBy",
        },
      );
    }
  };

  return PositionCompetency;
};
