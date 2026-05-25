
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ReportRunModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ReportRunModel => {
  const ReportRun = sequelize.define("ReportRun", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    reportDefinitionId: { type: dataTypes.UUID, allowNull: false },
    runByUserId: { type: dataTypes.UUID, allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: "pending" }, // pending, running, completed, error
    filtersUsed: { type: dataTypes.JSONB, defaultValue: {} },
    resultData: { type: dataTypes.JSONB, defaultValue: null }, // Actual JSON snapshot
    errorMessage: { type: dataTypes.TEXT, allowNull: true },
    startedAt: { type: dataTypes.DATE, defaultValue: dataTypes.NOW },
    completedAt: { type: dataTypes.DATE, allowNull: true }
  }, { tableName: "report_runs", timestamps: true }) as ReportRunModel;

  ReportRun.associate = (models: any) => {
    models.ReportRun.belongsTo(models.Business, { foreignKey: "businessId" });
    models.ReportRun.belongsTo(models.ReportDefinition, { foreignKey: "reportDefinitionId" });
    if(models.User) models.ReportRun.belongsTo(models.User, { foreignKey: "runByUserId" });
  };
  return ReportRun;
};
