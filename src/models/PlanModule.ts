import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type PlanModuleModel = ModelStatic<any> & {
  associate?: (models: any) => void;
};

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): PlanModuleModel => {
  const PlanModule = sequelize.define(
    "PlanModule",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      planId: { type: dataTypes.UUID, allowNull: false },
      moduleKey: { type: dataTypes.STRING(120), allowNull: false },
      moduleName: { type: dataTypes.STRING(120), allowNull: false },
      isEnabled: { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: false }
    },
    {
      tableName: "plan_modules",
      timestamps: true,
      indexes: [{ unique: true, fields: ["planId", "moduleKey"] }]
    }
  ) as PlanModuleModel;

  PlanModule.associate = (models: any) => {
    models.PlanModule.belongsTo(models.Plan, { foreignKey: "planId" });
  };

  return PlanModule;
};
