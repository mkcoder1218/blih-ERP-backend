import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type UserCalendarEventModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): UserCalendarEventModel => {
  const UserCalendarEvent = sequelize.define(
    "UserCalendarEvent",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false },
      employeeUserId: { type: dataTypes.UUID, allowNull: false },
      title: { type: dataTypes.STRING(255), allowNull: false },
      description: { type: dataTypes.TEXT, allowNull: true },
      location: { type: dataTypes.STRING(255), allowNull: true },
      startAt: { type: dataTypes.DATE, allowNull: false },
      endAt: { type: dataTypes.DATE, allowNull: false },
      allDay: { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      itemType: { type: dataTypes.STRING(30), allowNull: false, defaultValue: "EVENT" },
      availabilityStatus: { type: dataTypes.STRING(20), allowNull: false, defaultValue: "AVAILABLE" },
      projectId: { type: dataTypes.UUID, allowNull: true },
      projectTaskId: { type: dataTypes.UUID, allowNull: true },
      meetingRequestId: { type: dataTypes.UUID, allowNull: true },
      organizerUserId: { type: dataTypes.UUID, allowNull: true },
      color: { type: dataTypes.STRING(100), allowNull: true },
      googleEventId: { type: dataTypes.STRING(255), allowNull: true },
      googleCalendarId: { type: dataTypes.STRING(255), allowNull: true },
      googleSyncStatus: { type: dataTypes.STRING(30), allowNull: false, defaultValue: "NOT_SYNCED" },
      googleSyncError: { type: dataTypes.TEXT, allowNull: true },
      lastGoogleSyncedAt: { type: dataTypes.DATE, allowNull: true },
      syncSource: { type: dataTypes.STRING(30), allowNull: false, defaultValue: "BLIH" },
      googleUpdatedAt: { type: dataTypes.DATE, allowNull: true },
      googleETag: { type: dataTypes.STRING(255), allowNull: true },
      recurrenceRule: { type: dataTypes.TEXT, allowNull: true },
      googleRecurringEventId: { type: dataTypes.STRING(255), allowNull: true },
      googleOriginalStartTime: { type: dataTypes.JSONB, allowNull: true },
      isRecurring: { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      isRecurringInstance: { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      deletedSource: { type: dataTypes.STRING(30), allowNull: true },
      googleDeletedAt: { type: dataTypes.DATE, allowNull: true },
      googleSyncedAt: { type: dataTypes.DATE, allowNull: true },
      metadata: { type: dataTypes.JSONB, defaultValue: {} },
    },
    {
      tableName: "user_calendar_events",
      timestamps: true,
      paranoid: true,
    }
  ) as UserCalendarEventModel;

  UserCalendarEvent.associate = (models: any) => {
    models.UserCalendarEvent.belongsTo(models.Business, { foreignKey: "businessId" });
    models.UserCalendarEvent.belongsTo(models.User, { foreignKey: "employeeUserId", as: "employee" });
    models.UserCalendarEvent.belongsTo(models.User, { foreignKey: "organizerUserId", as: "organizer" });
    if (models.Project) models.UserCalendarEvent.belongsTo(models.Project, { foreignKey: "projectId", as: "project" });
    if (models.ProjectTask) models.UserCalendarEvent.belongsTo(models.ProjectTask, { foreignKey: "projectTaskId", as: "projectTask" });
  };

  return UserCalendarEvent;
};
