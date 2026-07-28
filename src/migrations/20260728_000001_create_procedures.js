'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create procedures table
    const proceduresExists = await queryInterface.tableExists('procedures');
    if (!proceduresExists) {
      await queryInterface.createTable('procedures', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        businessId: {
          type: Sequelize.UUID,
          allowNull: false
        },
        categoryId: {
          type: Sequelize.UUID,
          allowNull: true,
          references: {
            model: 'brain_categories',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        },
        authorUserId: {
          type: Sequelize.UUID,
          allowNull: false
        },
        responsibleDepartmentId: {
          type: Sequelize.UUID,
          allowNull: true
        },
        title: {
          type: Sequelize.STRING(500),
          allowNull: false
        },
        slug: {
          type: Sequelize.STRING(500),
          allowNull: false
        },
        purpose: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        scope: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        responsibilities: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        prerequisites: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        steps: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: []
        },
        expectedResult: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        visibility: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'company'
        },
        status: {
          type: Sequelize.STRING(50),
          allowNull: false,
          defaultValue: 'draft'
        },
        version: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 1
        },
        effectiveDate: {
          type: Sequelize.DATE,
          allowNull: true
        },
        reviewDueDate: {
          type: Sequelize.DATE,
          allowNull: true
        },
        submittedAt: {
          type: Sequelize.DATE,
          allowNull: true
        },
        submittedByUserId: {
          type: Sequelize.UUID,
          allowNull: true
        },
        reviewedAt: {
          type: Sequelize.DATE,
          allowNull: true
        },
        reviewedByUserId: {
          type: Sequelize.UUID,
          allowNull: true
        },
        publishedAt: {
          type: Sequelize.DATE,
          allowNull: true
        },
        publishedByUserId: {
          type: Sequelize.UUID,
          allowNull: true
        },
        archivedAt: {
          type: Sequelize.DATE,
          allowNull: true
        },
        archivedByUserId: {
          type: Sequelize.UUID,
          allowNull: true
        },
        metadata: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {}
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

      // Indexes for procedures
      await queryInterface.addIndex('procedures', ['businessId']);
      await queryInterface.addIndex('procedures', ['categoryId']);
      await queryInterface.addIndex('procedures', ['status']);
      await queryInterface.addIndex('procedures', ['businessId', 'slug'], {
        name: 'procedures_business_id_slug_unique',
        unique: true,
        where: { deletedAt: null }
      });
    }

    // 2. Create procedure_revisions table
    const procedureRevisionsExists = await queryInterface.tableExists('procedure_revisions');
    if (!procedureRevisionsExists) {
      await queryInterface.createTable('procedure_revisions', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        businessId: {
          type: Sequelize.UUID,
          allowNull: false
        },
        procedureId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'procedures',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        revisedByUserId: {
          type: Sequelize.UUID,
          allowNull: false
        },
        version: {
          type: Sequelize.INTEGER,
          allowNull: false
        },
        changeSummary: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        contentSnapshot: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {}
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });

      // Indexes for procedure revisions
      await queryInterface.addIndex('procedure_revisions', ['businessId']);
      await queryInterface.addIndex('procedure_revisions', ['procedureId']);
      await queryInterface.addIndex('procedure_revisions', ['procedureId', 'version'], {
        unique: true,
        name: 'idx_proc_revisions_proc_version_unique'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const procedureRevisionsExists = await queryInterface.tableExists('procedure_revisions');
    if (procedureRevisionsExists) {
      await queryInterface.dropTable('procedure_revisions');
    }

    const proceduresExists = await queryInterface.tableExists('procedures');
    if (proceduresExists) {
      await queryInterface.dropTable('procedures');
    }
  }
};
