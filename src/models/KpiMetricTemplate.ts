import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type KpiMetricTemplateModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): KpiMetricTemplateModel => {
  const KpiMetricTemplate = sequelize.define("KpiMetricTemplate", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    module: { type: dataTypes.STRING(100), allowNull: false },
    metricKey: { type: dataTypes.STRING(100), allowNull: false },
    title: { type: dataTypes.STRING(255), allowNull: false },
    unit: { type: dataTypes.STRING(50), allowNull: false },
    measurementType: { type: dataTypes.STRING(50), allowNull: false },
    direction: { type: dataTypes.STRING(50), allowNull: false } // INCREASE, DECREASE
  }, { tableName: "kpi_metric_templates", timestamps: true }) as KpiMetricTemplateModel;

  return KpiMetricTemplate;
};
