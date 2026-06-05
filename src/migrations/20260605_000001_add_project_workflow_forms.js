"use strict";

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

async function addIndexSafe(queryInterface, tableName, fields, name, options = {}) {
  const indexes = await queryInterface.showIndex(tableName);
  if (!indexes.some((idx) => idx.name === name)) {
    await queryInterface.addIndex(tableName, fields, { ...options, name });
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "project_workflow_forms"))) {
      await queryInterface.createTable("project_workflow_forms", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        businessId: { type: Sequelize.UUID, allowNull: false, references: { model: "businesses", key: "id" }, onDelete: "CASCADE" },
        projectId: { type: Sequelize.UUID, allowNull: false, references: { model: "projects", key: "id" }, onDelete: "CASCADE" },
        milestoneId: { type: Sequelize.UUID, allowNull: true, references: { model: "project_milestones", key: "id" }, onDelete: "SET NULL" },
        taskId: { type: Sequelize.UUID, allowNull: true, references: { model: "project_tasks", key: "id" }, onDelete: "SET NULL" },
        fileAssetId: { type: Sequelize.UUID, allowNull: true, references: { model: "file_assets", key: "id" }, onDelete: "SET NULL" },
        approvalRequestId: { type: Sequelize.UUID, allowNull: true, references: { model: "approval_requests", key: "id" }, onDelete: "SET NULL" },
        formKey: { type: Sequelize.STRING(120), allowNull: false },
        formName: { type: Sequelize.STRING(255), allowNull: false },
        workflowGroup: { type: Sequelize.STRING(80), allowNull: false },
        status: { type: Sequelize.STRING(50), allowNull: false, defaultValue: "draft" },
        submittedByUserId: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        reviewedByUserId: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        submittedAt: { type: Sequelize.DATE, allowNull: true },
        reviewedAt: { type: Sequelize.DATE, allowNull: true },
        archivedAt: { type: Sequelize.DATE, allowNull: true },
        data: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        adapters: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        deletedAt: { type: Sequelize.DATE, allowNull: true }
      });
    }

    await addIndexSafe(queryInterface, "project_workflow_forms", ["businessId", "projectId", "workflowGroup"], "idx_project_workflow_forms_business_project_group");
    await addIndexSafe(queryInterface, "project_workflow_forms", ["businessId", "projectId", "formKey"], "idx_project_workflow_forms_business_project_form");
    await addIndexSafe(queryInterface, "project_workflow_forms", ["businessId", "status"], "idx_project_workflow_forms_business_status");
    await addIndexSafe(queryInterface, "project_workflow_forms", ["businessId", "milestoneId"], "idx_project_workflow_forms_business_milestone");
    await addIndexSafe(queryInterface, "project_workflow_forms", ["businessId", "taskId"], "idx_project_workflow_forms_business_task");
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, "project_workflow_forms")) {
      await queryInterface.dropTable("project_workflow_forms");
    }
  }
};
