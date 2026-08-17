import { DataTypes } from "sequelize";
import { db } from "../../models";

const sequelize = db.sequelize;

export const TelegramDepartmentConfig =
  sequelize.models.TelegramDepartmentConfig ||
  sequelize.define(
    "TelegramDepartmentConfig",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      businessId: { type: DataTypes.UUID, allowNull: false },
      departmentId: { type: DataTypes.UUID, allowNull: false },
      enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
      tableName: "telegram_department_configs",
      timestamps: true,
      indexes: [{ unique: true, fields: ["businessId", "departmentId"] }],
    },
  );

export const TelegramDepartmentChannel =
  sequelize.models.TelegramDepartmentChannel ||
  sequelize.define(
    "TelegramDepartmentChannel",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      businessId: { type: DataTypes.UUID, allowNull: false },
      departmentId: { type: DataTypes.UUID, allowNull: false },
      chatId: { type: DataTypes.STRING(120), allowNull: false },
      label: { type: DataTypes.STRING(160), allowNull: true },
      enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      tableName: "telegram_department_channels",
      timestamps: true,
      indexes: [{ unique: true, fields: ["businessId", "departmentId", "chatId"] }],
    },
  );

export const TelegramTaskSyncLog =
  sequelize.models.TelegramTaskSyncLog ||
  sequelize.define(
    "TelegramTaskSyncLog",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      businessId: { type: DataTypes.UUID, allowNull: false },
      departmentId: { type: DataTypes.UUID, allowNull: false },
      employeeId: { type: DataTypes.UUID, allowNull: false },
      taskId: { type: DataTypes.UUID, allowNull: true },
      chatId: { type: DataTypes.STRING(120), allowNull: false },
      syncDate: { type: DataTypes.STRING(10), allowNull: false },
      syncType: { type: DataTypes.STRING(40), allowNull: false },
      dedupeKey: { type: DataTypes.STRING(500), allowNull: false },
      payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      sentAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      tableName: "telegram_task_sync_logs",
      timestamps: true,
      indexes: [{ unique: true, fields: ["businessId", "dedupeKey"] }],
    },
  );
