import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type OkrObjectiveModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): OkrObjectiveModel => {
  const OkrObjective = sequelize.define("OkrObjective", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    ownerType: { type: dataTypes.STRING(50), allowNull: false }, // COMPANY, DEPARTMENT, TEAM, EMPLOYEE
    ownerId: { type: dataTypes.UUID, allowNull: true, set(value: any) { this.setDataValue("ownerId", value === "" ? null : value); } },
    title: { type: dataTypes.STRING(500), allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: true },
    periodStart: { type: dataTypes.DATEONLY, allowNull: false },
    periodEnd: { type: dataTypes.DATEONLY, allowNull: false },
    lifecycleStatus: { type: dataTypes.STRING(50), defaultValue: "DRAFT" }, // DRAFT, ACTIVE, CLOSED, CANCELLED
    healthStatus: { type: dataTypes.STRING(50), defaultValue: "ON_TRACK" }, // ON_TRACK, AT_RISK, OFF_TRACK, COMPLETED
    overallScore: { type: dataTypes.FLOAT, defaultValue: 0.0 },
    createdById: { type: dataTypes.UUID, allowNull: false }
  }, { tableName: "okr_new_objectives", timestamps: true, paranoid: true }) as OkrObjectiveModel;

  OkrObjective.associate = (models: any) => {
    models.OkrObjective.belongsTo(models.Business, { foreignKey: "businessId" });
    models.OkrObjective.belongsTo(models.User, { foreignKey: "createdById", as: "creator" });
    models.OkrObjective.belongsTo(models.User, { foreignKey: "ownerId", as: "ownerEmployee", constraints: false });
    models.OkrObjective.belongsTo(models.Department, { foreignKey: "ownerId", as: "ownerDepartment", constraints: false });
    models.OkrObjective.hasMany(models.OkrKeyResult, { foreignKey: "objectiveId", as: "keyResults" });
    models.OkrObjective.hasMany(models.OkrImpact, { foreignKey: "objectiveId", as: "keyImpacts" });
  };
  return OkrObjective;
};
