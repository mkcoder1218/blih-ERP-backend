'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableExists = await queryInterface.tableExists('policy_public_shares');
    if (!tableExists) {
      await queryInterface.createTable('policy_public_shares', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        businessId: {
          type: Sequelize.UUID,
          allowNull: false
        },
        policyId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'policies',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        policyVersionId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'policy_versions',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        tokenHash: {
          type: Sequelize.STRING(64),
          allowNull: false,
          unique: true
        },
        enabled: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        expiresAt: {
          type: Sequelize.DATE,
          allowNull: true
        },
        revokedAt: {
          type: Sequelize.DATE,
          allowNull: true
        },
        createdByUserId: {
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
        }
      });

      await queryInterface.addIndex('policy_public_shares', ['tokenHash'], {
        unique: true,
        name: 'idx_policy_public_shares_token_hash_unique'
      });
      await queryInterface.addIndex('policy_public_shares', ['businessId']);
      await queryInterface.addIndex('policy_public_shares', ['policyId']);
      await queryInterface.addIndex('policy_public_shares', ['policyVersionId']);
      await queryInterface.addIndex('policy_public_shares', ['enabled']);
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableExists = await queryInterface.tableExists('policy_public_shares');
    if (tableExists) {
      await queryInterface.dropTable('policy_public_shares');
    }
  }
};
