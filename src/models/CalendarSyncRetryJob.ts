import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type CalendarSyncRetryJobModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): CalendarSyncRetryJobModel => {
  const CalendarSyncRetryJob = sequelize.define(
    "CalendarSyncRetryJob",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false },
      userId: { type: dataTypes.UUID, allowNull: false },
      localEventId: { type: dataTypes.UUID, allowNull: true },
      googleEventId: { type: dataTypes.STRING(255), allowNull: true },
      actionType: { type: dataTypes.STRING(60), allowNull: false },
      payload: { type: dataTypes.JSONB, allowNull: false, defaultValue: {} },
      status: { type: dataTypes.STRING(30), allowNull: false, defaultValue: "PENDING" },
      attemptCount: { type: dataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      maxAttempts: { type: dataTypes.INTEGER, allowNull: false, defaultValue: 5 },
      nextRunAt: { type: dataTypes.DATE, allowNull: false, defaultValue: dataTypes.NOW },
      lastError: { type: dataTypes.TEXT, allowNull: true },
    },
    {
      tableName: "calendar_sync_retry_jobs",
      timestamps: true,
    }
  ) as CalendarSyncRetryJobModel;

  CalendarSyncRetryJob.associate = (models: any) => {
    CalendarSyncRetryJob.belongsTo(models.Business, { foreignKey: "businessId" });
    CalendarSyncRetryJob.belongsTo(models.User, { foreignKey: "userId" });
    CalendarSyncRetryJob.belongsTo(models.UserCalendarEvent, { foreignKey: "localEventId", as: "event" });
  };

  return CalendarSyncRetryJob;
};
