import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type UserCalendarMeetingRequestModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): UserCalendarMeetingRequestModel => {
  const UserCalendarMeetingRequest = sequelize.define(
    "UserCalendarMeetingRequest",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false },
      requesterUserId: { type: dataTypes.UUID, allowNull: false },
      recipientUserId: { type: dataTypes.UUID, allowNull: false },
      title: { type: dataTypes.STRING(255), allowNull: false },
      description: { type: dataTypes.TEXT, allowNull: true },
      location: { type: dataTypes.STRING(255), allowNull: true },
      startAt: { type: dataTypes.DATE, allowNull: false },
      endAt: { type: dataTypes.DATE, allowNull: false },
      status: { type: dataTypes.STRING(30), allowNull: false, defaultValue: "PENDING" },
      requesterEventId: { type: dataTypes.UUID, allowNull: true },
      recipientEventId: { type: dataTypes.UUID, allowNull: true },
      responseNote: { type: dataTypes.TEXT, allowNull: true },
      respondedAt: { type: dataTypes.DATE, allowNull: true },
      metadata: { type: dataTypes.JSONB, defaultValue: {} },
    },
    { tableName: "user_calendar_meeting_requests", timestamps: true, paranoid: true }
  ) as UserCalendarMeetingRequestModel;

  UserCalendarMeetingRequest.associate = (models: any) => {
    models.UserCalendarMeetingRequest.belongsTo(models.Business, { foreignKey: "businessId" });
    models.UserCalendarMeetingRequest.belongsTo(models.User, { foreignKey: "requesterUserId", as: "requester" });
    models.UserCalendarMeetingRequest.belongsTo(models.User, { foreignKey: "recipientUserId", as: "recipient" });
  };

  return UserCalendarMeetingRequest;
};
