import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type OkrKeyResultModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): OkrKeyResultModel => {
  const OkrKeyResult = sequelize.define("OkrKeyResult", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    objectiveId: { type: dataTypes.UUID, allowNull: false },
    title: { type: dataTypes.STRING(500), allowNull: false },
    trackingType: { type: dataTypes.STRING(50), allowNull: false }, // AUTOMATIC, MANUAL
    moduleSelector: { type: dataTypes.STRING(120), allowNull: true },
    metricSelector: { type: dataTypes.STRING(120), allowNull: true },
    baselineValue: { type: dataTypes.FLOAT, defaultValue: 0.0 },
    targetValue: { type: dataTypes.FLOAT, allowNull: false },
    currentValue: { type: dataTypes.FLOAT, defaultValue: 0.0 },
    weight: { type: dataTypes.FLOAT, defaultValue: 1.0 },
    unit: { type: dataTypes.STRING(50), allowNull: true },
    measurementType: { type: dataTypes.STRING(50), allowNull: true },
    direction: { type: dataTypes.STRING(50), allowNull: true },
    metricVersion: { type: dataTypes.INTEGER, defaultValue: 1 },
    status: { type: dataTypes.STRING(50), defaultValue: "ON_TRACK" }, // ON_TRACK, AT_RISK, OFF_TRACK, COMPLETED
    baselinePeriodStart: { type: dataTypes.DATEONLY, allowNull: true },
    baselinePeriodEnd: { type: dataTypes.DATEONLY, allowNull: true },
    lastCalculatedAt: { type: dataTypes.DATE, allowNull: true }
  }, { tableName: "okr_new_key_results", timestamps: true, paranoid: true }) as OkrKeyResultModel;

  OkrKeyResult.associate = (models: any) => {
    models.OkrKeyResult.belongsTo(models.Business, { foreignKey: "businessId" });
    models.OkrKeyResult.belongsTo(models.OkrObjective, { foreignKey: "objectiveId" });
    models.OkrKeyResult.hasMany(models.OkrCheckIn, { foreignKey: "keyResultId", as: "checkIns" });
  };
  return OkrKeyResult;
};
