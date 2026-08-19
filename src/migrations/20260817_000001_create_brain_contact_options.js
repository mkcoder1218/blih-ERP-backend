"use strict";

const { randomUUID } = require("crypto");

const CONTACT_PERMISSIONS = [
  ["brain.contacts.view", "contacts.view", "View Brain contacts"],
  ["brain.contacts.create", "contacts.create", "Create Brain contacts"],
  ["brain.contacts.update", "contacts.update", "Update Brain contacts"],
  ["brain.contacts.delete", "contacts.delete", "Remove Brain contacts"],
  ["brain.contacts.fields.manage", "contacts.fields.manage", "Manage Brain contact fields"],
  ["brain.contacts.behaviors.manage", "contacts.behaviors.manage", "Manage Brain contact behaviors"],
  ["brain.contacts.client_options.manage", "contacts.client_options.manage", "Manage Brain client and influencer dropdown options"],
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("brain_contact_options", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      businessId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: "businesses", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      type: {
        type: Sequelize.STRING(40),
        allowNull: false,
      },
      label: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      color: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      createdByUserId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex("brain_contact_options", ["businessId", "type"], {
      name: "brain_contact_options_business_type_idx",
    });

    await queryInterface.addIndex("brain_contact_options", ["businessId", "type", "label"], {
      name: "brain_contact_options_business_type_label_idx",
    });

    const now = new Date();
    for (const [key, action, description] of CONTACT_PERMISSIONS) {
      await queryInterface.sequelize.query(
        `INSERT INTO "permissions" ("id", "module", "action", "key", "description", "createdAt", "updatedAt")
         VALUES (:id, 'brain', :action, :key, :description, :createdAt, :updatedAt)
         ON CONFLICT ("key") DO NOTHING`,
        {
          replacements: {
            id: randomUUID(),
            action,
            key,
            description,
            createdAt: now,
            updatedAt: now,
          },
        },
      );
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("permissions", {
      key: { [Sequelize.Op.in]: CONTACT_PERMISSIONS.map(([key]) => key) },
    });
    await queryInterface.dropTable("brain_contact_options");
  },
};
