"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("telegram_department_configs", {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      businessId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "businesses", key: "id" },
        onDelete: "CASCADE",
      },
      departmentId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "departments", key: "id" },
        onDelete: "CASCADE",
      },
      enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });
    await queryInterface.addIndex("telegram_department_configs", ["businessId", "departmentId"], {
      unique: true,
      name: "telegram_department_configs_business_department_unique",
    });

    await queryInterface.createTable("telegram_department_channels", {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      businessId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "businesses", key: "id" },
        onDelete: "CASCADE",
      },
      departmentId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "departments", key: "id" },
        onDelete: "CASCADE",
      },
      chatId: { type: Sequelize.STRING(120), allowNull: false },
      label: { type: Sequelize.STRING(160), allowNull: true },
      enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });
    await queryInterface.addIndex("telegram_department_channels", ["businessId", "departmentId", "chatId"], {
      unique: true,
      name: "telegram_department_channels_business_department_chat_unique",
    });

    await queryInterface.createTable("telegram_task_sync_logs", {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      businessId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "businesses", key: "id" },
        onDelete: "CASCADE",
      },
      departmentId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "departments", key: "id" },
        onDelete: "CASCADE",
      },
      employeeId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "hr_employee_records", key: "id" },
        onDelete: "CASCADE",
      },
      taskId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "project_tasks", key: "id" },
        onDelete: "SET NULL",
      },
      chatId: { type: Sequelize.STRING(120), allowNull: false },
      syncDate: { type: Sequelize.STRING(10), allowNull: false },
      syncType: { type: Sequelize.STRING(40), allowNull: false },
      dedupeKey: { type: Sequelize.STRING(500), allowNull: false },
      payload: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      sentAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
    });
    await queryInterface.addIndex("telegram_task_sync_logs", ["businessId", "dedupeKey"], {
      unique: true,
      name: "telegram_task_sync_logs_business_dedupe_unique",
    });
    await queryInterface.addIndex("telegram_task_sync_logs", ["businessId", "syncDate", "syncType"], {
      name: "telegram_task_sync_logs_date_type_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("telegram_task_sync_logs");
    await queryInterface.dropTable("telegram_department_channels");
    await queryInterface.dropTable("telegram_department_configs");
  },
};
