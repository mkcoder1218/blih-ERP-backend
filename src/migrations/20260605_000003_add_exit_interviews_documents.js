"use strict";

async function tableExists(queryInterface, tableName) {
  try { await queryInterface.describeTable(tableName); return true; } catch { return false; }
}

async function addIndexSafe(queryInterface, tableName, fields, name, options = {}) {
  const indexes = await queryInterface.showIndex(tableName);
  if (!indexes.some((idx) => idx.name === name)) await queryInterface.addIndex(tableName, fields, { ...options, name });
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "businesses")) || !(await tableExists(queryInterface, "hr_exit_processes"))) {
      return;
    }

    if (!(await tableExists(queryInterface, "hr_exit_interviews"))) {
      await queryInterface.createTable("hr_exit_interviews", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        businessId: { type: Sequelize.UUID, allowNull: false, references: { model: "businesses", key: "id" }, onDelete: "CASCADE" },
        exitProcessId: { type: Sequelize.UUID, allowNull: false, references: { model: "hr_exit_processes", key: "id" }, onDelete: "CASCADE" },
        scheduledAt: { type: Sequelize.DATE, allowNull: false },
        location: { type: Sequelize.STRING(255), allowNull: true },
        meetingUrl: { type: Sequelize.TEXT, allowNull: true },
        interviewerUserId: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        status: { type: Sequelize.STRING(50), allowNull: false, defaultValue: "scheduled" },
        rating: { type: Sequelize.FLOAT, allowNull: true },
        reasonForLeaving: { type: Sequelize.TEXT, allowNull: true },
        satisfactionScore: { type: Sequelize.INTEGER, allowNull: true },
        managementFeedback: { type: Sequelize.TEXT, allowNull: true },
        workEnvironmentFeedback: { type: Sequelize.TEXT, allowNull: true },
        careerDevelopmentFeedback: { type: Sequelize.TEXT, allowNull: true },
        suggestions: { type: Sequelize.TEXT, allowNull: true },
        wouldRecommendCompany: { type: Sequelize.BOOLEAN, allowNull: true },
        remarks: { type: Sequelize.TEXT, allowNull: true },
        completedAt: { type: Sequelize.DATE, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        deletedAt: { type: Sequelize.DATE, allowNull: true }
      });
    }

    if (!(await tableExists(queryInterface, "hr_exit_documents"))) {
      await queryInterface.createTable("hr_exit_documents", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        businessId: { type: Sequelize.UUID, allowNull: false, references: { model: "businesses", key: "id" }, onDelete: "CASCADE" },
        exitProcessId: { type: Sequelize.UUID, allowNull: false, references: { model: "hr_exit_processes", key: "id" }, onDelete: "CASCADE" },
        documentKey: { type: Sequelize.STRING(120), allowNull: false },
        title: { type: Sequelize.STRING(255), allowNull: false },
        required: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        status: { type: Sequelize.STRING(50), allowNull: false, defaultValue: "missing" },
        fileUrl: { type: Sequelize.TEXT, allowNull: true },
        uploadedAt: { type: Sequelize.DATE, allowNull: true },
        uploadedByUserId: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        verifiedAt: { type: Sequelize.DATE, allowNull: true },
        verifiedByUserId: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        notes: { type: Sequelize.TEXT, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        deletedAt: { type: Sequelize.DATE, allowNull: true }
      });
    }

    await addIndexSafe(queryInterface, "hr_exit_interviews", ["businessId", "status"], "idx_exit_interviews_business_status");
    await addIndexSafe(queryInterface, "hr_exit_interviews", ["businessId", "exitProcessId"], "idx_exit_interviews_business_exit");
    await addIndexSafe(queryInterface, "hr_exit_documents", ["businessId", "exitProcessId"], "idx_exit_documents_business_exit");
    await addIndexSafe(queryInterface, "hr_exit_documents", ["exitProcessId", "documentKey"], "uniq_exit_documents_exit_key", { unique: true });
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, "hr_exit_documents")) await queryInterface.dropTable("hr_exit_documents");
    if (await tableExists(queryInterface, "hr_exit_interviews")) await queryInterface.dropTable("hr_exit_interviews");
  }
};
