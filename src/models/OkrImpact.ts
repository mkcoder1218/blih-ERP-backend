import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type OkrImpactModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): OkrImpactModel => {
  const OkrImpact = sequelize.define("OkrImpact", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    objectiveId: { type: dataTypes.UUID, allowNull: false },
    text: { type: dataTypes.STRING(500), allowNull: false }
  }, { tableName: "okr_new_impacts", timestamps: true }) as OkrImpactModel;

  OkrImpact.associate = (models: any) => {
    models.OkrImpact.belongsTo(models.OkrObjective, { foreignKey: "objectiveId" });
  };
  return OkrImpact;
};
