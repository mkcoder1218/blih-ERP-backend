"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("projects", "departmentId", {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: "departments", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.addIndex("projects", ["businessId", "departmentId"], {
      name: "projects_business_department_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("projects", "projects_business_department_idx");
    await queryInterface.removeColumn("projects", "departmentId");
  },
};
