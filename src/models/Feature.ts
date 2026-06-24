import type { DataTypes, ModelStatic, Sequelize } from "sequelize";
export default (sequelize: Sequelize, d: typeof DataTypes): ModelStatic<any> & { associate?: (m: any) => void } => {
  const Feature = sequelize.define("Feature", {
    id: { type: d.UUID, defaultValue: d.UUIDV4, primaryKey: true },
    key: { type: d.STRING(100), allowNull: false, unique: true },
    name: { type: d.STRING(150), allowNull: false },
    description: { type: d.TEXT },
    category: { type: d.STRING(100) },
    isMetered: { type: d.BOOLEAN, allowNull: false, defaultValue: false },
    unitName: { type: d.STRING(50) }
  }, { tableName: "features", timestamps: true }) as any;
  Feature.associate = (m: any) => Feature.hasMany(m.PlanFeature, { foreignKey: "featureId", as: "planFeatures" });
  return Feature;
};
