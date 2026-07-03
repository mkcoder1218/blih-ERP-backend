"use strict";

async function addColumnSafe(queryInterface, Sequelize, tableName, columnName, definition) {
  const table = await queryInterface.describeTable(tableName);
  if (!table[columnName]) await queryInterface.addColumn(tableName, columnName, definition);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await addColumnSafe(queryInterface, Sequelize, "user_calendar_events", "recurrenceRule", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await addColumnSafe(queryInterface, Sequelize, "user_calendar_events", "googleRecurringEventId", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await addColumnSafe(queryInterface, Sequelize, "user_calendar_events", "googleOriginalStartTime", {
      type: Sequelize.JSONB,
      allowNull: true,
    });
    await addColumnSafe(queryInterface, Sequelize, "user_calendar_events", "isRecurring", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await addColumnSafe(queryInterface, Sequelize, "user_calendar_events", "isRecurringInstance", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await addColumnSafe(queryInterface, Sequelize, "user_calendar_events", "deletedSource", {
      type: Sequelize.STRING(30),
      allowNull: true,
    });
    await addColumnSafe(queryInterface, Sequelize, "user_calendar_events", "googleDeletedAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    const tables = await queryInterface.showAllTables();
    if (!tables.includes("calendar_sync_retry_jobs")) {
      await queryInterface.createTable("calendar_sync_retry_jobs", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        businessId: { type: Sequelize.UUID, allowNull: false },
        userId: { type: Sequelize.UUID, allowNull: false },
        localEventId: { type: Sequelize.UUID, allowNull: true },
        googleEventId: { type: Sequelize.STRING(255), allowNull: true },
        actionType: { type: Sequelize.STRING(60), allowNull: false },
        payload: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "PENDING" },
        attemptCount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        maxAttempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 5 },
        nextRunAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        lastError: { type: Sequelize.TEXT, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      });
      await queryInterface.addIndex("calendar_sync_retry_jobs", ["status", "nextRunAt"], { name: "calendar_sync_retry_jobs_status_next_idx" });
      await queryInterface.addIndex("calendar_sync_retry_jobs", ["businessId", "userId"], { name: "calendar_sync_retry_jobs_business_user_idx" });
      await queryInterface.addIndex("calendar_sync_retry_jobs", ["localEventId"], { name: "calendar_sync_retry_jobs_local_event_idx" });
    }

    if (!tables.includes("calendar_sync_audit_logs")) {
      await queryInterface.createTable("calendar_sync_audit_logs", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        businessId: { type: Sequelize.UUID, allowNull: false },
        userId: { type: Sequelize.UUID, allowNull: true },
        localEventId: { type: Sequelize.UUID, allowNull: true },
        googleEventId: { type: Sequelize.STRING(255), allowNull: true },
        direction: { type: Sequelize.STRING(40), allowNull: false },
        action: { type: Sequelize.STRING(40), allowNull: false },
        status: { type: Sequelize.STRING(30), allowNull: false },
        message: { type: Sequelize.STRING(500), allowNull: true },
        errorDetails: { type: Sequelize.TEXT, allowNull: true },
        metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      });
      await queryInterface.addIndex("calendar_sync_audit_logs", ["businessId", "userId", "createdAt"], { name: "calendar_sync_audit_logs_business_user_idx" });
      await queryInterface.addIndex("calendar_sync_audit_logs", ["localEventId", "createdAt"], { name: "calendar_sync_audit_logs_event_idx" });
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    if (tables.includes("calendar_sync_audit_logs")) await queryInterface.dropTable("calendar_sync_audit_logs");
    if (tables.includes("calendar_sync_retry_jobs")) await queryInterface.dropTable("calendar_sync_retry_jobs");
    const table = await queryInterface.describeTable("user_calendar_events");
    for (const column of ["googleDeletedAt", "deletedSource", "isRecurringInstance", "isRecurring", "googleOriginalStartTime", "googleRecurringEventId", "recurrenceRule"]) {
      if (table[column]) await queryInterface.removeColumn("user_calendar_events", column);
    }
  },
};
