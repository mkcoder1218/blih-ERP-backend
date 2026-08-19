'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableExists = await queryInterface.tableExists('policy_versions');
    if (!tableExists) {
      await queryInterface.createTable('policy_versions', {
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
        version: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        versionLabel: {
          type: Sequelize.STRING(80),
          allowNull: true
        },
        title: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        slug: {
          type: Sequelize.STRING(160),
          allowNull: false
        },
        policyType: {
          type: Sequelize.STRING(120),
          allowNull: false
        },
        summary: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        contentHtml: {
          type: Sequelize.TEXT,
          allowNull: false
        },
        contentJson: {
          type: Sequelize.JSONB,
          allowNull: true
        },
        contentText: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        contentHash: {
          type: Sequelize.STRING(64),
          allowNull: false
        },
        visibility: {
          type: Sequelize.STRING(40),
          allowNull: false,
          defaultValue: 'company'
        },
        confidentialityLevel: {
          type: Sequelize.STRING(40),
          allowNull: false,
          defaultValue: 'normal'
        },
        effectiveFrom: {
          type: Sequelize.DATE,
          allowNull: true
        },
        effectiveUntil: {
          type: Sequelize.DATE,
          allowNull: true
        },
        requiresAcceptance: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        requiresSignature: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        assignmentSnapshot: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: []
        },
        metadataSnapshot: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {}
        },
        statusAtCreation: {
          type: Sequelize.STRING(40),
          allowNull: false
        },
        action: {
          type: Sequelize.STRING(60),
          allowNull: false
        },
        changeSummary: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        reviewComment: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        restoredFromVersionId: {
          type: Sequelize.UUID,
          allowNull: true
        },
        supersedesVersionId: {
          type: Sequelize.UUID,
          allowNull: true
        },
        createdByUserId: {
          type: Sequelize.UUID,
          allowNull: true
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });

      await queryInterface.addIndex('policy_versions', ['businessId']);
      await queryInterface.addIndex('policy_versions', ['policyId']);
      await queryInterface.addIndex('policy_versions', ['policyId', 'version'], {
        unique: true,
        name: 'idx_policy_versions_policy_version_unique'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableExists = await queryInterface.tableExists('policy_versions');
    if (tableExists) {
      await queryInterface.dropTable('policy_versions');
    }
  }
};
