
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type PositionModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): PositionModel => {
  const Position = sequelize.define("Position", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    departmentId: { type: dataTypes.UUID, allowNull: false },
    title: { type: dataTypes.STRING(120), allowNull: false },
    key: { type: dataTypes.STRING(120), allowNull: false },
    level: { type: dataTypes.INTEGER, defaultValue: 1 },
    description: { type: dataTypes.STRING, allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: "active" }
  }, { tableName: "positions", timestamps: true, paranoid: true }) as PositionModel;

  Position.associate = (models: any) => {
    models.Position.belongsTo(models.Business, { foreignKey: "businessId" });
    models.Position.belongsTo(models.Department, { foreignKey: "departmentId" });
    models.Position.hasMany(models.BusinessUserProfile, { foreignKey: "positionId" });
  };
  return Position;
};