"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const SystemHealthLog = sequelize.define("SystemHealthLog", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        serviceName: { type: dataTypes.STRING(100), allowNull: false }, // database, storage, redis
        status: { type: dataTypes.STRING(50), allowNull: false }, // healthy, degraded, down
        message: { type: dataTypes.TEXT, allowNull: true },
        metadata: { type: dataTypes.JSONB, defaultValue: {} },
        checkedAt: { type: dataTypes.DATE, defaultValue: dataTypes.NOW }
    }, { tableName: "system_health_logs", timestamps: true, updatedAt: false });
    return SystemHealthLog;
};
