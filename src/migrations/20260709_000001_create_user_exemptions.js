"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("user_exemptions", {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      businessId: { type: Sequelize.UUID, allowNull: false },
      userId: { type: Sequelize.UUID, allowNull: false },
      reason: { type: Sequelize.TEXT, allowNull: false },
      excludeFromPayroll: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      status: { type: Sequelize.ENUM("PENDING", "APPROVED", "REJECTED"), allowNull: false, defaultValue: "PENDING" },
      requestedBy: { type: Sequelize.UUID, allowNull: false },
      approvedBy: { type: Sequelize.UUID, allowNull: true },
      rejectedBy: { type: Sequelize.UUID, allowNull: true },
      approvedAt: { type: Sequelize.DATE, allowNull: true },
      rejectedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      deletedAt: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex("user_exemptions", ["businessId", "userId", "status"], { name: "user_exemptions_business_user_status_idx" });
    await queryInterface.addIndex("user_exemptions", ["businessId", "status"], { name: "user_exemptions_business_status_idx" });
    await queryInterface.addConstraint("user_exemptions", {
      fields: ["businessId"],
      type: "foreign key",
      name: "user_exemptions_businessId_fkey",
      references: { table: "businesses", field: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
    for (const field of ["userId", "requestedBy", "approvedBy", "rejectedBy"]) {
      await queryInterface.addConstraint("user_exemptions", {
        fields: [field],
        type: "foreign key",
        name: `user_exemptions_${field}_fkey`,
        references: { table: "users", field: "id" },
        onDelete: field === "userId" || field === "requestedBy" ? "CASCADE" : "SET NULL",
        onUpdate: "CASCADE",
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable("user_exemptions");
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_user_exemptions_status";');
  },
};
