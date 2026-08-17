"use strict";

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
  },

  async down(queryInterface) {
    await queryInterface.dropTable("brain_contact_options");
  },
};
