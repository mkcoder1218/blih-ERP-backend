import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type OkrMetricTemplateModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): OkrMetricTemplateModel => {
  const OkrMetricTemplate = sequelize.define("OkrMetricTemplate", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    module: { type: dataTypes.STRING(100), allowNull: false }, // Attendance, Recruitment, Projects, Probation, Leave
    metricKey: { type: dataTypes.STRING(100), allowNull: false },
    title: { type: dataTypes.STRING(255), allowNull: false },
    unit: { type: dataTypes.STRING(50), allowNull: false },
    measurementType: { type: dataTypes.STRING(50), allowNull: false },
    direction: { type: dataTypes.STRING(50), allowNull: false } // HIGHER_IS_BETTER, LOWER_IS_BETTER
  }, {
    tableName: "okr_new_metric_templates",
    timestamps: true,
    indexes: [{ unique: true, fields: ["module", "metricKey"] }]
  }) as OkrMetricTemplateModel;

  return OkrMetricTemplate;
};
