import { DataTypes } from "sequelize";
import { db } from "../../models";

export const CalendarMeeting =
  db.sequelize.models.UserCalendarMeeting ||
  db.sequelize.define(
    "UserCalendarMeeting",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      businessId: { type: DataTypes.UUID, allowNull: false },
      organizerUserId: { type: DataTypes.UUID, allowNull: false },
      title: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      location: { type: DataTypes.STRING(255), allowNull: true },
      startAt: { type: DataTypes.DATE, allowNull: false },
      endAt: { type: DataTypes.DATE, allowNull: false },
      status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "ACTIVE" },
      organizerEventId: { type: DataTypes.UUID, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    },
    {
      tableName: "user_calendar_meetings",
      timestamps: true,
      paranoid: true,
    },
  );

export const CalendarMeetingAttendee =
  db.sequelize.models.UserCalendarMeetingAttendee ||
  db.sequelize.define(
    "UserCalendarMeetingAttendee",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      businessId: { type: DataTypes.UUID, allowNull: false },
      meetingId: { type: DataTypes.UUID, allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: false },
      status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "PENDING" },
      responseNote: { type: DataTypes.TEXT, allowNull: true },
      respondedAt: { type: DataTypes.DATE, allowNull: true },
      calendarEventId: { type: DataTypes.UUID, allowNull: true },
      metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    },
    {
      tableName: "user_calendar_meeting_attendees",
      timestamps: true,
      paranoid: true,
    },
  );
