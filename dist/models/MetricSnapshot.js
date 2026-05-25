"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const MetricSnapshot = sequelize.define("MetricSnapshot", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        moduleKey: { type: dataTypes.STRING(50), allowNull: false },
        metricKey: { type: dataTypes.STRING(100), allowNull: false },
        metricName: { type: dataTypes.STRING(255), allowNull: false },
        value: { type: dataTypes.FLOAT, allowNull: false },
        unit: { type: dataTypes.STRING(50), allowNull: true },
        dimensions: { type: dataTypes.JSONB, defaultValue: {} },
        periodType: { type: dataTypes.STRING(50), defaultValue: "daily" }, // point_in_time, daily, weekly, monthly
        periodStart: { type: dataTypes.DATE, allowNull: true },
        periodEnd: { type: dataTypes.DATE, allowNull: true }
    }, { tableName: "metric_snapshots", timestamps: true }); // No paranoid needed for timeseries
    MetricSnapshot.associate = (models) => {
        models.MetricSnapshot.belongsTo(models.Business, { foreignKey: "businessId" });
    };
    return MetricSnapshot;
};
