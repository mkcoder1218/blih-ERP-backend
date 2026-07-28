'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableExists = await queryInterface.tableExists('policy_assignments');
    if (!tableExists) {
      await queryInterface.createTable('policy_assignments', {
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
        subjectType: {
          type: Sequelize.STRING(40),
          allowNull: false
        },
        subjectId: {
          type: Sequelize.STRING(255),
          allowNull: false,
          defaultValue: 'ALL'
        },
        assignmentType: {
          type: Sequelize.STRING(40),
          allowNull: false,
          defaultValue: 'INCLUDE'
        },
        isRequired: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
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
        dueAt: {
          type: Sequelize.DATE,
          allowNull: true
        },
        assignedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        assignedByUserId: {
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

      await queryInterface.addIndex('policy_assignments', ['businessId']);
      await queryInterface.addIndex('policy_assignments', ['policyId']);
      await queryInterface.addIndex('policy_assignments', ['policyVersionId']);
      await queryInterface.addIndex('policy_assignments', ['subjectType', 'subjectId']);
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableExists = await queryInterface.tableExists('policy_assignments');
    if (tableExists) {
      await queryInterface.dropTable('policy_assignments');
    }
  }
};
