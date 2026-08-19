"use strict";

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.includes(tableName);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "hr_employment_change_requests"))) {
      await queryInterface.createTable("hr_employment_change_requests", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        businessId: { type: Sequelize.UUID, allowNull: false },
        employeeUserId: { type: Sequelize.UUID, allowNull: false },
        requestedByUserId: { type: Sequelize.UUID, allowNull: false },
        requestKind: { type: Sequelize.STRING(30), allowNull: false },
        titleChangeType: { type: Sequelize.STRING(40), allowNull: true },
        currentPositionId: { type: Sequelize.UUID, allowNull: true },
        currentTitle: { type: Sequelize.STRING(255), allowNull: true },
        targetPositionId: { type: Sequelize.UUID, allowNull: true },
        targetTitle: { type: Sequelize.STRING(255), allowNull: true },
        currentDepartmentId: { type: Sequelize.UUID, allowNull: true },
        targetDepartmentId: { type: Sequelize.UUID, allowNull: true },
        currentSalary: { type: Sequelize.FLOAT, allowNull: true },
        requestedSalary: { type: Sequelize.FLOAT, allowNull: true },
        recommendedSalary: { type: Sequelize.FLOAT, allowNull: true },
        reason: { type: Sequelize.TEXT, allowNull: false },
        effectiveDate: { type: Sequelize.DATEONLY, allowNull: false },
        attachmentUrl: { type: Sequelize.STRING(1000), allowNull: true },
        status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "PENDING" },
        approvalStage: { type: Sequelize.STRING(30), allowNull: false, defaultValue: "MANAGER" },
        currentApproverUserId: { type: Sequelize.UUID, allowNull: true },
        currentApproverRoleKey: { type: Sequelize.STRING(80), allowNull: true },
        approvedAt: { type: Sequelize.DATE, allowNull: true },
        scheduledAt: { type: Sequelize.DATE, allowNull: true },
        appliedAt: { type: Sequelize.DATE, allowNull: true },
        rejectedAt: { type: Sequelize.DATE, allowNull: true },
        cancelledAt: { type: Sequelize.DATE, allowNull: true },
        metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        deletedAt: { type: Sequelize.DATE, allowNull: true },
      });

      await queryInterface.addIndex(
        "hr_employment_change_requests",
        ["businessId", "employeeUserId", "status"],
        { name: "employment_change_employee_status_idx" },
      );
      await queryInterface.addIndex(
        "hr_employment_change_requests",
        ["businessId", "currentApproverUserId", "status"],
        { name: "employment_change_current_approver_idx" },
      );
      await queryInterface.addIndex(
        "hr_employment_change_requests",
        ["businessId", "currentApproverRoleKey", "status"],
        { name: "employment_change_current_role_idx" },
      );
      await queryInterface.addIndex(
        "hr_employment_change_requests",
        ["status", "effectiveDate"],
        { name: "employment_change_effective_date_idx" },
      );
    }

    if (!(await tableExists(queryInterface, "hr_employment_change_actions"))) {
      await queryInterface.createTable("hr_employment_change_actions", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        businessId: { type: Sequelize.UUID, allowNull: false },
        requestId: { type: Sequelize.UUID, allowNull: false },
        actorUserId: { type: Sequelize.UUID, allowNull: true },
        stage: { type: Sequelize.STRING(30), allowNull: true },
        action: { type: Sequelize.STRING(30), allowNull: false },
        comment: { type: Sequelize.TEXT, allowNull: true },
        beforeData: { type: Sequelize.JSONB, allowNull: true },
        afterData: { type: Sequelize.JSONB, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      });

      await queryInterface.addIndex(
        "hr_employment_change_actions",
        ["businessId", "requestId", "createdAt"],
        { name: "employment_change_actions_request_idx" },
      );
    }
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, "hr_employment_change_actions")) {
      await queryInterface.dropTable("hr_employment_change_actions");
    }
    if (await tableExists(queryInterface, "hr_employment_change_requests")) {
      await queryInterface.dropTable("hr_employment_change_requests");
    }
  },
};
