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
    if (!(await tableExists(queryInterface, "businesses")) || !(await tableExists(queryInterface, "hr_exit_processes"))) {
      return;
    }

    if (!(await tableExists(queryInterface, "hr_exit_clearance_steps"))) {
      await queryInterface.createTable("hr_exit_clearance_steps", {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        businessId: { type: Sequelize.UUID, allowNull: false, references: { model: "businesses", key: "id" }, onDelete: "CASCADE" },
        exitProcessId: { type: Sequelize.UUID, allowNull: false, references: { model: "hr_exit_processes", key: "id" }, onDelete: "CASCADE" },
        stepKey: { type: Sequelize.STRING(120), allowNull: false },
        title: { type: Sequelize.STRING(255), allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: true },
        sortOrder: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        required: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        status: { type: Sequelize.STRING(50), allowNull: false, defaultValue: "pending" },
        completedAt: { type: Sequelize.DATE, allowNull: true },
        completedByUserId: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onDelete: "SET NULL" },
        notes: { type: Sequelize.TEXT, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        deletedAt: { type: Sequelize.DATE, allowNull: true }
      });
    }

    await addIndexSafe(queryInterface, "hr_exit_clearance_steps", ["businessId", "exitProcessId"], "idx_exit_clearance_steps_business_exit");
    await addIndexSafe(queryInterface, "hr_exit_clearance_steps", ["businessId", "status"], "idx_exit_clearance_steps_business_status");
    await addIndexSafe(queryInterface, "hr_exit_clearance_steps", ["exitProcessId", "stepKey"], "uniq_exit_clearance_steps_exit_step", { unique: true });
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, "hr_exit_clearance_steps")) {
      await queryInterface.dropTable("hr_exit_clearance_steps");
    }
  }
};
