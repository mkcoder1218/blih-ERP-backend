import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type SectorFocusModel = ModelStatic<any> & {
  associate?: (models: any) => void;
};

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): SectorFocusModel => {
  const SectorFocus = sequelize.define(
    "SectorFocus",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      name: { type: dataTypes.STRING(120), allowNull: false },
      key: { type: dataTypes.STRING(50), allowNull: false, unique: true },
      description: { type: dataTypes.STRING(255), allowNull: true },
      status: { type: dataTypes.STRING(50), allowNull: false, defaultValue: "active" }
    },
    {
      tableName: "sector_focuses",
      timestamps: true,
      paranoid: true
    }
  ) as SectorFocusModel;

  SectorFocus.associate = (models: any) => {
    models.SectorFocus.hasMany(models.Business, { foreignKey: "sectorFocusId" });
  };

  return SectorFocus;
};

