"use strict";

const { randomUUID } = require("crypto");

const PERMISSIONS = [
  ["brain.contact_categories.view", "contact_categories.view", "View custom Brain contact categories"],
  ["brain.contact_categories.create", "contact_categories.create", "Create custom Brain contact categories"],
  ["brain.contact_categories.update", "contact_categories.update", "Update custom Brain contact categories"],
  ["brain.contact_categories.archive", "contact_categories.archive", "Archive custom Brain contact categories"],
  ["brain.contact_fields.create", "contact_fields.create", "Create custom Brain contact fields"],
  ["brain.contact_fields.update", "contact_fields.update", "Update custom Brain contact fields"],
  ["brain.contact_fields.archive", "contact_fields.archive", "Archive custom Brain contact fields"],
  ["brain.contact_fields.reorder", "contact_fields.reorder", "Reorder custom Brain contact fields"],
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("brain_contact_categories", {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      businessId: { type: Sequelize.UUID, allowNull: false, references: { model: "businesses", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
      name: { type: Sequelize.STRING(120), allowNull: false },
      iconName: { type: Sequelize.STRING(120), allowNull: false, defaultValue: "Users" },
      description: { type: Sequelize.STRING(500), allowNull: true },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      sortOrder: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      createdByUserId: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL" },
      updatedByUserId: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL" },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      deletedAt: { type: Sequelize.DATE, allowNull: true },
    });

    await queryInterface.createTable("brain_contact_fields", {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      businessId: { type: Sequelize.UUID, allowNull: false, references: { model: "businesses", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
      categoryId: { type: Sequelize.UUID, allowNull: false, references: { model: "brain_contact_categories", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
      key: { type: Sequelize.STRING(100), allowNull: false },
      label: { type: Sequelize.STRING(120), allowNull: false },
      type: { type: Sequelize.STRING(30), allowNull: false },
      isRequired: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      showInTable: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      sortOrder: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      options: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      isSystem: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      isArchived: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      createdByUserId: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL" },
      updatedByUserId: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL" },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.createTable("brain_custom_contacts", {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      businessId: { type: Sequelize.UUID, allowNull: false, references: { model: "businesses", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
      categoryId: { type: Sequelize.UUID, allowNull: false, references: { model: "brain_contact_categories", key: "id" }, onUpdate: "CASCADE", onDelete: "RESTRICT" },
      name: { type: Sequelize.STRING(255), allowNull: false },
      values: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      createdByUserId: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL" },
      updatedByUserId: { type: Sequelize.UUID, allowNull: true, references: { model: "users", key: "id" }, onUpdate: "CASCADE", onDelete: "SET NULL" },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      deletedAt: { type: Sequelize.DATE, allowNull: true },
    });

    await queryInterface.createTable("brain_contact_column_preferences", {
      id: { type: Sequelize.UUID, allowNull: false, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
      businessId: { type: Sequelize.UUID, allowNull: false, references: { model: "businesses", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
      userId: { type: Sequelize.UUID, allowNull: false, references: { model: "users", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
      categoryId: { type: Sequelize.UUID, allowNull: false, references: { model: "brain_contact_categories", key: "id" }, onUpdate: "CASCADE", onDelete: "CASCADE" },
      visibleFieldIds: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
    });

    await queryInterface.addIndex("brain_contact_categories", ["businessId", "isActive", "sortOrder"], { name: "brain_contact_categories_business_active_order_idx" });
    await queryInterface.addIndex("brain_contact_categories", ["businessId", "name"], { name: "brain_contact_categories_business_name_idx" });
    await queryInterface.addIndex("brain_contact_fields", ["categoryId", "key"], { unique: true, name: "brain_contact_fields_category_key_uq" });
    await queryInterface.addIndex("brain_contact_fields", ["businessId", "categoryId", "isArchived", "sortOrder"], { name: "brain_contact_fields_business_category_order_idx" });
    await queryInterface.addIndex("brain_custom_contacts", ["businessId", "categoryId", "updatedAt"], { name: "brain_custom_contacts_business_category_updated_idx" });
    await queryInterface.addIndex("brain_contact_column_preferences", ["userId", "categoryId"], { unique: true, name: "brain_contact_column_preferences_user_category_uq" });

    const now = new Date();
    for (const [key, action, description] of PERMISSIONS) {
      await queryInterface.sequelize.query(
        `INSERT INTO "permissions" ("id","module","action","key","description","createdAt","updatedAt")
         VALUES (:id,'brain',:action,:key,:description,:now,:now) ON CONFLICT ("key") DO NOTHING`,
        { replacements: { id: randomUUID(), action, key, description, now } },
      );
    }

    const permissionRows = await queryInterface.sequelize.query(
      `SELECT "id","key" FROM "permissions" WHERE "key" IN (:keys)`,
      { replacements: { keys: PERMISSIONS.map(([key]) => key) }, type: Sequelize.QueryTypes.SELECT },
    );
    const roleRows = await queryInterface.sequelize.query(
      `SELECT "id","key" FROM "roles" WHERE "key" IN ('PLATFORM_SUPER_ADMIN','BUSINESS_ADMIN','HR_MANAGER','FINANCE_MANAGER','DEPARTMENT_HEAD','PROJECT_MANAGER','EMPLOYEE')`,
      { type: Sequelize.QueryTypes.SELECT },
    );
    for (const role of roleRows) {
      for (const permission of permissionRows) {
        if (role.key === "EMPLOYEE" && permission.key !== "brain.contact_categories.view") continue;
        await queryInterface.sequelize.query(
          `INSERT INTO "role_permissions" ("id","roleId","permissionId","createdAt","updatedAt")
           VALUES (:id,:roleId,:permissionId,:now,:now) ON CONFLICT ("roleId","permissionId") DO NOTHING`,
          { replacements: { id: randomUUID(), roleId: role.id, permissionId: permission.id, now } },
        );
      }
    }
  },

  async down(queryInterface, Sequelize) {
    const rows = await queryInterface.sequelize.query(
      `SELECT "id" FROM "permissions" WHERE "key" IN (:keys)`,
      { replacements: { keys: PERMISSIONS.map(([key]) => key) }, type: Sequelize.QueryTypes.SELECT },
    );
    const ids = rows.map((row) => row.id);
    if (ids.length) await queryInterface.bulkDelete("role_permissions", { permissionId: { [Sequelize.Op.in]: ids } });
    await queryInterface.bulkDelete("permissions", { key: { [Sequelize.Op.in]: PERMISSIONS.map(([key]) => key) } });
    await queryInterface.dropTable("brain_contact_column_preferences");
    await queryInterface.dropTable("brain_custom_contacts");
    await queryInterface.dropTable("brain_contact_fields");
    await queryInterface.dropTable("brain_contact_categories");
  },
};
