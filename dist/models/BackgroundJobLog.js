"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const BackgroundJobLog = sequelize.define("BackgroundJobLog", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: true },
        jobName: { type: dataTypes.STRING(255), allowNull: false },
        jobType: { type: dataTypes.STRING(50), allowNull: false }, // report, import, billing
        status: { type: dataTypes.STRING(50), defaultValue: "pending" }, // pending, running, success, failed
        attempts: { type: dataTypes.INTEGER, defaultValue: 0 },
        startedAt: { type: dataTypes.DATE, allowNull: true },
        finishedAt: { type: dataTypes.DATE, allowNull: true },
        errorMessage: { type: dataTypes.TEXT, allowNull: true },
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "background_job_logs", timestamps: true });
    BackgroundJobLog.associate = (models) => {
        if (models.Business)
            BackgroundJobLog.belongsTo(models.Business, { foreignKey: "businessId" });
    };
    return BackgroundJobLog;
};
