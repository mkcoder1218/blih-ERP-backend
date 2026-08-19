"use strict";

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "project_task_comments"))) return;

    const table = await queryInterface.describeTable("project_task_comments");

    if (!table.authorUserId) {
      const usersExist = await tableExists(queryInterface, "users");
      await queryInterface.addColumn("project_task_comments", "authorUserId", {
        type: Sequelize.UUID,
        allowNull: true,
        ...(usersExist
          ? {
              references: { model: "users", key: "id" },
              onDelete: "SET NULL",
              onUpdate: "CASCADE",
            }
          : {}),
      });
    }

    // Keep the existing EmployeeRecord foreign key intact; only relax NOT NULL.
    // This avoids re-creating or duplicating the existing PostgreSQL FK constraint.
    await queryInterface.sequelize.query(`
      ALTER TABLE "project_task_comments"
      ALTER COLUMN "authorEmployeeId" DROP NOT NULL
    `);

    const employeesExist = await tableExists(queryInterface, "hr_employee_records");
    if (employeesExist && (await tableExists(queryInterface, "users"))) {
      await queryInterface.sequelize.query(`
        UPDATE "project_task_comments" AS comments
        SET "authorUserId" = employees."userId"
        FROM "hr_employee_records" AS employees
        WHERE comments."authorEmployeeId" = employees.id
          AND comments."authorUserId" IS NULL
          AND employees."userId" IS NOT NULL
      `);
    }

    const indexes = await queryInterface.showIndex("project_task_comments");
    if (!indexes.some((index) => index.name === "idx_project_task_comments_author_user")) {
      await queryInterface.addIndex("project_task_comments", ["businessId", "authorUserId"], {
        name: "idx_project_task_comments_author_user",
      });
    }
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface, "project_task_comments"))) return;

    const indexes = await queryInterface.showIndex("project_task_comments");
    if (indexes.some((index) => index.name === "idx_project_task_comments_author_user")) {
      await queryInterface.removeIndex(
        "project_task_comments",
        "idx_project_task_comments_author_user",
      );
    }

    const table = await queryInterface.describeTable("project_task_comments");
    if (table.authorUserId) {
      await queryInterface.removeColumn("project_task_comments", "authorUserId");
    }

    // Keep authorEmployeeId nullable: comments created by authenticated project
    // users without EmployeeRecord links are valid discussion history.
  },
};
