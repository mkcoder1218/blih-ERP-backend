
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type SystemHealthLogModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): SystemHealthLogModel => {
  const SystemHealthLog = sequelize.define("SystemHealthLog", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    serviceName: { type: dataTypes.STRING(100), allowNull: false }, // database, storage, redis
    status: { type: dataTypes.STRING(50), allowNull: false }, // healthy, degraded, down
    message: { type: dataTypes.TEXT, allowNull: true },
    metadata: { type: dataTypes.JSONB, defaultValue: {} },
    checkedAt: { type: dataTypes.DATE, defaultValue: dataTypes.NOW }
  }, { tableName: "system_health_logs", timestamps: true, updatedAt: false }) as SystemHealthLogModel;
  return SystemHealthLog;
};
