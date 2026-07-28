'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableExists = await queryInterface.tableExists('policy_categories');
    if (!tableExists) {
      await queryInterface.createTable('policy_categories', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        businessId: {
          type: Sequelize.UUID,
          allowNull: false
        },
        parentCategoryId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'policy_categories',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        name: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        key: {
          type: Sequelize.STRING(160),
          allowNull: false
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        status: {
          type: Sequelize.STRING(40),
          allowNull: false,
          defaultValue: 'active'
        },
        createdByUserId: {
          type: Sequelize.UUID,
          allowNull: true
        },
        updatedByUserId: {
          type: Sequelize.UUID,
          allowNull: true
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false
        },
        deletedAt: {
          type: Sequelize.DATE,
          allowNull: true
        }
      });

      await queryInterface.addIndex('policy_categories', ['businessId']);
      await queryInterface.addIndex('policy_categories', ['parentCategoryId']);
      await queryInterface.addIndex('policy_categories', ['status']);
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableExists = await queryInterface.tableExists('policy_categories');
    if (tableExists) {
      await queryInterface.dropTable('policy_categories');
    }
  }
};
