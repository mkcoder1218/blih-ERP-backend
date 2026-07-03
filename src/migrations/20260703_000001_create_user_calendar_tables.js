"use strict";

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.includes(tableName);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "user_calendar_events"))) {
      await queryInterface.createTable("user_calendar_events", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        businessId: { type: Sequelize.UUID, allowNull: false },
        employeeUserId: { type: Sequelize.UUID, allowNull: false },
        title: { type: Sequelize.STRING(255), allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: true },
        location: { type: Sequelize.STRING(255), allowNull: true },
        startAt: { type: Sequelize.DATE, allowNull: false },
        endAt: { type: Sequelize.DATE, allowNull: false },
        allDay: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        itemType: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "EVENT" },
        availabilityStatus: { type: Sequelize.STRING(20), allowNull: false, defaultValue: "AVAILABLE" },
        projectId: { type: Sequelize.UUID, allowNull: true },
        projectTaskId: { type: Sequelize.UUID, allowNull: true },
        meetingRequestId: { type: Sequelize.UUID, allowNull: true },
        organizerUserId: { type: Sequelize.UUID, allowNull: true },
        color: { type: Sequelize.STRING(100), allowNull: true },
        googleEventId: { type: Sequelize.STRING(255), allowNull: true },
        googleCalendarId: { type: Sequelize.STRING(255), allowNull: true },
        googleSyncStatus: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "NOT_SYNCED" },
        googleSyncError: { type: Sequelize.TEXT, allowNull: true },
        lastGoogleSyncedAt: { type: Sequelize.DATE, allowNull: true },
        syncSource: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "BLIH" },
        googleUpdatedAt: { type: Sequelize.DATE, allowNull: true },
        googleETag: { type: Sequelize.STRING(255), allowNull: true },
        recurrenceRule: { type: Sequelize.TEXT, allowNull: true },
        googleRecurringEventId: { type: Sequelize.STRING(255), allowNull: true },
        googleOriginalStartTime: { type: Sequelize.JSONB, allowNull: true },
        isRecurring: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        isRecurringInstance: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        deletedSource: { type: Sequelize.STRING(30), allowNull: true },
        googleDeletedAt: { type: Sequelize.DATE, allowNull: true },
        googleSyncedAt: { type: Sequelize.DATE, allowNull: true },
        metadata: { type: Sequelize.JSONB, defaultValue: {} },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        deletedAt: { type: Sequelize.DATE, allowNull: true },
      });
      await queryInterface.addIndex("user_calendar_events", ["businessId", "employeeUserId"], { name: "user_calendar_events_business_employee_idx" });
      await queryInterface.addIndex("user_calendar_events", ["startAt", "endAt"], { name: "user_calendar_events_range_idx" });
      await queryInterface.addIndex("user_calendar_events", ["googleEventId"], { name: "user_calendar_events_google_event_idx" });
    }

    if (!(await tableExists(queryInterface, "user_calendar_meeting_requests"))) {
      await queryInterface.createTable("user_calendar_meeting_requests", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        businessId: { type: Sequelize.UUID, allowNull: false },
        requesterUserId: { type: Sequelize.UUID, allowNull: false },
        recipientUserId: { type: Sequelize.UUID, allowNull: false },
        title: { type: Sequelize.STRING(255), allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: true },
        location: { type: Sequelize.STRING(255), allowNull: true },
        startAt: { type: Sequelize.DATE, allowNull: false },
        endAt: { type: Sequelize.DATE, allowNull: false },
        status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "PENDING" },
        requesterEventId: { type: Sequelize.UUID, allowNull: true },
        recipientEventId: { type: Sequelize.UUID, allowNull: true },
        responseNote: { type: Sequelize.TEXT, allowNull: true },
        respondedAt: { type: Sequelize.DATE, allowNull: true },
        metadata: { type: Sequelize.JSONB, defaultValue: {} },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        deletedAt: { type: Sequelize.DATE, allowNull: true },
      });
      await queryInterface.addIndex("user_calendar_meeting_requests", ["businessId", "recipientUserId", "status"], { name: "calendar_meetings_recipient_status_idx" });
      await queryInterface.addIndex("user_calendar_meeting_requests", ["businessId", "requesterUserId", "status"], { name: "calendar_meetings_requester_status_idx" });
    }
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, "user_calendar_meeting_requests")) {
      await queryInterface.dropTable("user_calendar_meeting_requests");
    }
    if (await tableExists(queryInterface, "user_calendar_events")) {
      await queryInterface.dropTable("user_calendar_events");
    }
  },
};
