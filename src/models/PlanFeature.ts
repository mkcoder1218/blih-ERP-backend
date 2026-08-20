import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export default (sequelize: Sequelize, d: typeof DataTypes): ModelStatic<any> & { associate?: (m: any) => void } => {
  const PlanFeature = sequelize.define(
    "PlanFeature",
    {
      id: { type: d.UUID, defaultValue: d.UUIDV4, primaryKey: true },
      planId: { type: d.UUID, allowNull: false },
      featureId: { type: d.UUID, allowNull: false },
      isEnabled: { type: d.BOOLEAN, allowNull: false, defaultValue: false },
      limitValue: { type: d.DECIMAL(14, 2), allowNull: true },
      limitPeriod: { type: d.ENUM("daily", "monthly", "yearly", "lifetime"), allowNull: true },
      overageUnitPrice: { type: d.DECIMAL(14, 4), allowNull: false, defaultValue: 0 },
    },
    {
      tableName: "plan_features",
      timestamps: true,
      indexes: [{ unique: true, fields: ["planId", "featureId"] }],
    },
  ) as any;

  PlanFeature.associate = (m: any) => {
    PlanFeature.belongsTo(m.Plan, { foreignKey: "planId", as: "plan" });
    PlanFeature.belongsTo(m.Feature, { foreignKey: "featureId", as: "feature" });
  };

  return PlanFeature;
};
