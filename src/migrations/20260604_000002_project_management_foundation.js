"use strict";

const common = (Sequelize, paranoid = true) => ({
  id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
  businessId: { type: Sequelize.UUID, allowNull: false, references: { model: "businesses", key: "id" }, onDelete: "CASCADE" },
  metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
  createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
  ...(paranoid ? { deletedAt: { type: Sequelize.DATE, allowNull: true } } : {})
});

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

async function addColumnIfMissing(queryInterface, tableName, columnName, definition) {
  const table = await queryInterface.describeTable(tableName);
  if (!table[columnName]) await queryInterface.addColumn(tableName, columnName, definition);
}

async function addIndexSafe(queryInterface, tableName, fields, name, options = {}) {
  const indexes = await queryInterface.showIndex(tableName);
  if (!indexes.some((idx) => idx.name === name)) {
    await queryInterface.addIndex(tableName, fields, { ...options, name });
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "projects"))) {
      await queryInterface.createTable("projects", {
        ...common(Sequelize),
        clientId: { type: Sequelize.UUID, allowNull: true, references: { model: "crm_clients", key: "id" }, onDelete: "SET NULL" },
        dealId: { type: Sequelize.UUID, allowNull: true, references: { model: "crm_deals", key: "id" }, onDelete: "SET NULL" },
        ownerEmployeeId: { type: Sequelize.UUID, allowNull: true, references: { model: "hr_employee_records", key: "id" }, onDelete: "SET NULL" },
        managerEmployeeId: { type: Sequelize.UUID, allowNull: true, references: { model: "hr_employee_records", key: "id" }, onDelete: "SET NULL" },
        projectManagerUserId: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        title: { type: Sequelize.STRING(255), allowNull: false },
        code: { type: Sequelize.STRING(50), allowNull: true },
        type: { type: Sequelize.STRING(100), allowNull: false, defaultValue: "standard" },
        description: { type: Sequelize.TEXT, allowNull: true },
        startDate: { type: Sequelize.DATEONLY, allowNull: true },
        endDate: { type: Sequelize.DATEONLY, allowNull: true },
        budget: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
        currency: { type: Sequelize.STRING(10), allowNull: false, defaultValue: "USD" },
        priority: { type: Sequelize.STRING(50), allowNull: false, defaultValue: "NORMAL" },
        progressPercent: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        status: { type: Sequelize.STRING(50), allowNull: false, defaultValue: "DRAFT" }
      });
    } else {
      await addColumnIfMissing(queryInterface, "projects", "ownerEmployeeId", { type: Sequelize.UUID, allowNull: true, references: { model: "hr_employee_records", key: "id" }, onDelete: "SET NULL" });
      await addColumnIfMissing(queryInterface, "projects", "managerEmployeeId", { type: Sequelize.UUID, allowNull: true, references: { model: "hr_employee_records", key: "id" }, onDelete: "SET NULL" });
      await addColumnIfMissing(queryInterface, "projects", "priority", { type: Sequelize.STRING(50), allowNull: false, defaultValue: "NORMAL" });
      await addColumnIfMissing(queryInterface, "projects", "progressPercent", { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
    }

    if (!(await tableExists(queryInterface, "project_milestones"))) {
      await queryInterface.createTable("project_milestones", {
        ...common(Sequelize),
        projectId: { type: Sequelize.UUID, allowNull: false, references: { model: "projects", key: "id" }, onDelete: "CASCADE" },
        name: { type: Sequelize.STRING(255), allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: true },
        dueDate: { type: Sequelize.DATEONLY, allowNull: true },
        billingPercent: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
        status: { type: Sequelize.STRING(50), allowNull: false, defaultValue: "pending" }
      });
    }

    if (!(await tableExists(queryInterface, "project_tasks"))) {
      await queryInterface.createTable("project_tasks", {
        ...common(Sequelize),
        projectId: { type: Sequelize.UUID, allowNull: false, references: { model: "projects", key: "id" }, onDelete: "CASCADE" },
        milestoneId: { type: Sequelize.UUID, allowNull: true, references: { model: "project_milestones", key: "id" }, onDelete: "SET NULL" },
        assigneeEmployeeId: { type: Sequelize.UUID, allowNull: true, references: { model: "hr_employee_records", key: "id" }, onDelete: "SET NULL" },
        assignedToUserId: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        code: { type: Sequelize.STRING(60), allowNull: true },
        title: { type: Sequelize.STRING(255), allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: true },
        priority: { type: Sequelize.STRING(50), allowNull: false, defaultValue: "MEDIUM" },
        status: { type: Sequelize.STRING(50), allowNull: false, defaultValue: "TODO" },
        startDate: { type: Sequelize.DATEONLY, allowNull: true },
        dueDate: { type: Sequelize.DATEONLY, allowNull: true },
        weight: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 1 },
        estimatedHours: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 },
        actualHours: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 0 }
      });
    } else {
      await addColumnIfMissing(queryInterface, "project_tasks", "assigneeEmployeeId", { type: Sequelize.UUID, allowNull: true, references: { model: "hr_employee_records", key: "id" }, onDelete: "SET NULL" });
      await addColumnIfMissing(queryInterface, "project_tasks", "code", { type: Sequelize.STRING(60), allowNull: true });
      await addColumnIfMissing(queryInterface, "project_tasks", "weight", { type: Sequelize.FLOAT, allowNull: false, defaultValue: 1 });
    }

    if (!(await tableExists(queryInterface, "project_members"))) {
      await queryInterface.createTable("project_members", {
        ...common(Sequelize),
        projectId: { type: Sequelize.UUID, allowNull: false, references: { model: "projects", key: "id" }, onDelete: "CASCADE" },
        employeeId: { type: Sequelize.UUID, allowNull: false, references: { model: "hr_employee_records", key: "id" }, onDelete: "CASCADE" },
        role: { type: Sequelize.STRING(80), allowNull: false, defaultValue: "MEMBER" },
        allocationPercent: { type: Sequelize.FLOAT, allowNull: false, defaultValue: 100 },
        startDate: { type: Sequelize.DATEONLY, allowNull: true },
        endDate: { type: Sequelize.DATEONLY, allowNull: true },
        status: { type: Sequelize.STRING(50), allowNull: false, defaultValue: "active" }
      });
    }

    if (!(await tableExists(queryInterface, "project_task_comments"))) {
      await queryInterface.createTable("project_task_comments", {
        ...common(Sequelize),
        projectId: { type: Sequelize.UUID, allowNull: false, references: { model: "projects", key: "id" }, onDelete: "CASCADE" },
        taskId: { type: Sequelize.UUID, allowNull: false, references: { model: "project_tasks", key: "id" }, onDelete: "CASCADE" },
        authorEmployeeId: { type: Sequelize.UUID, allowNull: false, references: { model: "hr_employee_records", key: "id" }, onDelete: "CASCADE" },
        body: { type: Sequelize.TEXT, allowNull: false }
      });
    }

    if (!(await tableExists(queryInterface, "project_activity_logs"))) {
      await queryInterface.createTable("project_activity_logs", {
        ...common(Sequelize, false),
        projectId: { type: Sequelize.UUID, allowNull: false, references: { model: "projects", key: "id" }, onDelete: "CASCADE" },
        taskId: { type: Sequelize.UUID, allowNull: true, references: { model: "project_tasks", key: "id" }, onDelete: "SET NULL" },
        actorEmployeeId: { type: Sequelize.UUID, allowNull: true, references: { model: "hr_employee_records", key: "id" }, onDelete: "SET NULL" },
        action: { type: Sequelize.STRING(120), allowNull: false },
        entityType: { type: Sequelize.STRING(80), allowNull: false },
        entityId: { type: Sequelize.UUID, allowNull: true },
        before: { type: Sequelize.JSONB, allowNull: true },
        after: { type: Sequelize.JSONB, allowNull: true }
      });
    }

    await addIndexSafe(queryInterface, "projects", ["businessId", "code"], "idx_projects_business_code", { unique: true, where: { deletedAt: null } });
    await addIndexSafe(queryInterface, "projects", ["businessId", "status"], "idx_projects_business_status");
    await addIndexSafe(queryInterface, "projects", ["businessId", "managerEmployeeId"], "idx_projects_business_manager_employee");
    await addIndexSafe(queryInterface, "project_tasks", ["businessId", "projectId", "status"], "idx_project_tasks_business_project_status");
    await addIndexSafe(queryInterface, "project_tasks", ["businessId", "code"], "idx_project_tasks_business_code", { unique: true, where: { deletedAt: null } });
    await addIndexSafe(queryInterface, "project_tasks", ["businessId", "assigneeEmployeeId"], "idx_project_tasks_business_assignee_employee");
    await addIndexSafe(queryInterface, "project_members", ["businessId", "projectId", "employeeId"], "idx_project_members_business_project_employee", { unique: true, where: { deletedAt: null } });
    await addIndexSafe(queryInterface, "project_task_comments", ["businessId", "taskId", "createdAt"], "idx_project_task_comments_business_task_created");
    await addIndexSafe(queryInterface, "project_activity_logs", ["businessId", "projectId", "createdAt"], "idx_project_activity_logs_business_project_created");
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, "project_activity_logs")) await queryInterface.dropTable("project_activity_logs");
    if (await tableExists(queryInterface, "project_task_comments")) await queryInterface.dropTable("project_task_comments");
    if (await tableExists(queryInterface, "project_members")) await queryInterface.dropTable("project_members");
  }
};
