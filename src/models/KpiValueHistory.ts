import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type KpiValueHistoryModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): KpiValueHistoryModel => {
  const KpiValueHistory = sequelize.define("KpiValueHistory", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    kpiId: { type: dataTypes.UUID, allowNull: false },
    value: { type: dataTypes.FLOAT, allowNull: false },
    previousValue: { type: dataTypes.FLOAT, allowNull: true },
    source: { type: dataTypes.STRING(50), allowNull: false }, // MANUAL, AUTOMATIC
    date: { type: dataTypes.DATEONLY, allowNull: false },
    note: { type: dataTypes.TEXT, allowNull: true },
    calculatedAt: { type: dataTypes.DATE, allowNull: false },
    calculationMetadata: { type: dataTypes.JSONB, allowNull: true },
    createdById: { type: dataTypes.UUID, allowNull: true }
  }, { tableName: "kpi_value_history", timestamps: true }) as KpiValueHistoryModel;

  KpiValueHistory.associate = (models: any) => {
    models.KpiValueHistory.belongsTo(models.Business, { foreignKey: "businessId" });
    models.KpiValueHistory.belongsTo(models.Kpi, { foreignKey: "kpiId", as: "kpi" });
    models.KpiValueHistory.belongsTo(models.User, { foreignKey: "createdById", as: "creator" });
  };
  return KpiValueHistory;
};
