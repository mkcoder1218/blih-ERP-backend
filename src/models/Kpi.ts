import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type KpiModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): KpiModel => {
  const Kpi = sequelize.define("Kpi", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    title: { type: dataTypes.STRING(255), allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: true },
    category: { type: dataTypes.STRING(100), allowNull: false },
    ownerType: { type: dataTypes.STRING(50), allowNull: false }, // COMPANY, DEPARTMENT, TEAM, EMPLOYEE
    ownerId: { type: dataTypes.UUID, allowNull: true, set(value: any) { this.setDataValue("ownerId", value === "" ? null : value); } },
    measurementType: { type: dataTypes.STRING(50), allowNull: false }, // PERCENTAGE, NUMBER, DURATION
    unit: { type: dataTypes.STRING(50), allowNull: false },
    direction: { type: dataTypes.STRING(50), allowNull: false }, // INCREASE, DECREASE
    baselineValue: { type: dataTypes.FLOAT, allowNull: false, defaultValue: 0.0 },
    currentValue: { type: dataTypes.FLOAT, allowNull: false, defaultValue: 0.0 },
    targetValue: { type: dataTypes.FLOAT, allowNull: false },
    updateFrequency: { type: dataTypes.STRING(50), allowNull: false }, // WEEKLY, MONTHLY, QUARTERLY, ANNUAL
    trackingType: { type: dataTypes.STRING(50), allowNull: false }, // AUTOMATIC, MANUAL
    moduleSelector: { type: dataTypes.STRING(100), allowNull: true },
    metricSelector: { type: dataTypes.STRING(100), allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: "ON_TARGET" }, // EXCEEDING_TARGET, ON_TARGET, BELOW_TARGET
    isActive: { type: dataTypes.BOOLEAN, defaultValue: true },
    createdById: { type: dataTypes.UUID, allowNull: false }
  }, { tableName: "kpis", timestamps: true, paranoid: true }) as KpiModel;

  Kpi.associate = (models: any) => {
    models.Kpi.belongsTo(models.Business, { foreignKey: "businessId" });
    models.Kpi.belongsTo(models.User, { foreignKey: "createdById", as: "creator" });
    models.Kpi.belongsTo(models.User, { foreignKey: "ownerId", as: "ownerEmployee", constraints: false });
    models.Kpi.belongsTo(models.Department, { foreignKey: "ownerId", as: "ownerDepartment", constraints: false });
    models.Kpi.hasMany(models.KpiValueHistory, { foreignKey: "kpiId", as: "valueHistory" });
  };
  return Kpi;
};
