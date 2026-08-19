"use strict";

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.includes(tableName);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "user_calendar_meetings"))) {
      await queryInterface.createTable("user_calendar_meetings", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        businessId: { type: Sequelize.UUID, allowNull: false },
        organizerUserId: { type: Sequelize.UUID, allowNull: false },
        title: { type: Sequelize.STRING(255), allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: true },
        location: { type: Sequelize.STRING(255), allowNull: true },
        startAt: { type: Sequelize.DATE, allowNull: false },
        endAt: { type: Sequelize.DATE, allowNull: false },
        status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "ACTIVE" },
        organizerEventId: { type: Sequelize.UUID, allowNull: true },
        metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        deletedAt: { type: Sequelize.DATE, allowNull: true },
      });

      await queryInterface.addIndex(
        "user_calendar_meetings",
        ["businessId", "organizerUserId", "startAt"],
        { name: "calendar_group_meetings_organizer_start_idx" },
      );
      await queryInterface.addIndex(
        "user_calendar_meetings",
        ["businessId", "status", "startAt"],
        { name: "calendar_group_meetings_status_start_idx" },
      );
    }

    if (!(await tableExists(queryInterface, "user_calendar_meeting_attendees"))) {
      await queryInterface.createTable("user_calendar_meeting_attendees", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        businessId: { type: Sequelize.UUID, allowNull: false },
        meetingId: { type: Sequelize.UUID, allowNull: false },
        userId: { type: Sequelize.UUID, allowNull: false },
        status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "PENDING" },
        responseNote: { type: Sequelize.TEXT, allowNull: true },
        respondedAt: { type: Sequelize.DATE, allowNull: true },
        calendarEventId: { type: Sequelize.UUID, allowNull: true },
        metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        deletedAt: { type: Sequelize.DATE, allowNull: true },
      });

      await queryInterface.addIndex(
        "user_calendar_meeting_attendees",
        ["meetingId", "userId"],
        { name: "calendar_group_meeting_attendee_unique", unique: true },
      );
      await queryInterface.addIndex(
        "user_calendar_meeting_attendees",
        ["businessId", "userId", "status"],
        { name: "calendar_group_attendees_user_status_idx" },
      );
    }
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, "user_calendar_meeting_attendees")) {
      await queryInterface.dropTable("user_calendar_meeting_attendees");
    }
    if (await tableExists(queryInterface, "user_calendar_meetings")) {
      await queryInterface.dropTable("user_calendar_meetings");
    }
  },
};
