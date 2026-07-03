import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type CalendarSyncAuditLogModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): CalendarSyncAuditLogModel => {
  const CalendarSyncAuditLog = sequelize.define(
    "CalendarSyncAuditLog",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false },
      userId: { type: dataTypes.UUID, allowNull: true },
      localEventId: { type: dataTypes.UUID, allowNull: true },
      googleEventId: { type: dataTypes.STRING(255), allowNull: true },
      direction: { type: dataTypes.STRING(40), allowNull: false },
      action: { type: dataTypes.STRING(40), allowNull: false },
      status: { type: dataTypes.STRING(30), allowNull: false },
      message: { type: dataTypes.STRING(500), allowNull: true },
      errorDetails: { type: dataTypes.TEXT, allowNull: true },
      metadata: { type: dataTypes.JSONB, allowNull: false, defaultValue: {} },
    },
    {
      tableName: "calendar_sync_audit_logs",
      timestamps: true,
      updatedAt: false,
    }
  ) as CalendarSyncAuditLogModel;

  CalendarSyncAuditLog.associate = (models: any) => {
    CalendarSyncAuditLog.belongsTo(models.Business, { foreignKey: "businessId" });
    CalendarSyncAuditLog.belongsTo(models.User, { foreignKey: "userId" });
    CalendarSyncAuditLog.belongsTo(models.UserCalendarEvent, { foreignKey: "localEventId", as: "event" });
  };

  return CalendarSyncAuditLog;
};
