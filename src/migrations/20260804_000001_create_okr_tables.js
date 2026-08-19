'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create okr_new_objectives
    const objectivesExists = await queryInterface.tableExists('okr_new_objectives');
    if (!objectivesExists) {
      await queryInterface.createTable('okr_new_objectives', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        businessId: {
          type: Sequelize.UUID,
          allowNull: false
        },
        ownerType: {
          type: Sequelize.STRING(50), // COMPANY, DEPARTMENT, TEAM, EMPLOYEE
          allowNull: false
        },
        ownerId: {
          type: Sequelize.UUID,
          allowNull: true // Nullable for COMPANY if necessary
        },
        title: {
          type: Sequelize.STRING(500),
          allowNull: false
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        periodStart: {
          type: Sequelize.DATEONLY,
          allowNull: false
        },
        periodEnd: {
          type: Sequelize.DATEONLY,
          allowNull: false
        },
        lifecycleStatus: {
          type: Sequelize.STRING(50), // DRAFT, ACTIVE, CLOSED, CANCELLED
          allowNull: false,
          defaultValue: 'DRAFT'
        },
        healthStatus: {
          type: Sequelize.STRING(50), // ON_TRACK, AT_RISK, OFF_TRACK, COMPLETED
          allowNull: false,
          defaultValue: 'ON_TRACK'
        },
        overallScore: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 0.0
        },
        createdById: {
          type: Sequelize.UUID,
          allowNull: false
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
      await queryInterface.addIndex('okr_new_objectives', ['businessId']);
      await queryInterface.addIndex('okr_new_objectives', ['ownerType', 'ownerId']);
    }

    // 2. Create okr_new_key_results
    const keyResultsExists = await queryInterface.tableExists('okr_new_key_results');
    if (!keyResultsExists) {
      await queryInterface.createTable('okr_new_key_results', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        businessId: {
          type: Sequelize.UUID,
          allowNull: false
        },
        objectiveId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'okr_new_objectives',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        title: {
          type: Sequelize.STRING(500),
          allowNull: false
        },
        trackingType: {
          type: Sequelize.STRING(50), // AUTOMATIC, MANUAL
          allowNull: false
        },
        moduleSelector: {
          type: Sequelize.STRING(120),
          allowNull: true
        },
        metricSelector: {
          type: Sequelize.STRING(120),
          allowNull: true
        },
        baselineValue: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 0.0
        },
        targetValue: {
          type: Sequelize.FLOAT,
          allowNull: false
        },
        currentValue: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 0.0
        },
        weight: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 1.0
        },
        unit: {
          type: Sequelize.STRING(50),
          allowNull: true
        },
        measurementType: {
          type: Sequelize.STRING(50),
          allowNull: true
        },
        direction: {
          type: Sequelize.STRING(50),
          allowNull: true
        },
        metricVersion: {
          type: Sequelize.INTEGER,
          allowNull: true,
          defaultValue: 1
        },
        status: {
          type: Sequelize.STRING(50), // ON_TRACK, AT_RISK, OFF_TRACK, COMPLETED
          allowNull: false,
          defaultValue: 'ON_TRACK'
        },
        baselinePeriodStart: {
          type: Sequelize.DATEONLY,
          allowNull: true
        },
        baselinePeriodEnd: {
          type: Sequelize.DATEONLY,
          allowNull: true
        },
        lastCalculatedAt: {
          type: Sequelize.DATE,
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
      await queryInterface.addIndex('okr_new_key_results', ['businessId']);
      await queryInterface.addIndex('okr_new_key_results', ['objectiveId']);
    }

    // 3. Create okr_new_check_ins
    const checkInsExists = await queryInterface.tableExists('okr_new_check_ins');
    if (!checkInsExists) {
      await queryInterface.createTable('okr_new_check_ins', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        businessId: {
          type: Sequelize.UUID,
          allowNull: false
        },
        keyResultId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'okr_new_key_results',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        progressValue: {
          type: Sequelize.FLOAT,
          allowNull: false
        },
        date: {
          type: Sequelize.DATEONLY,
          allowNull: false
        },
        note: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        createdById: {
          type: Sequelize.UUID,
          allowNull: false
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
      await queryInterface.addIndex('okr_new_check_ins', ['businessId']);
      await queryInterface.addIndex('okr_new_check_ins', ['keyResultId']);
    }

    // 4. Create okr_new_impacts
    const impactsExists = await queryInterface.tableExists('okr_new_impacts');
    if (!impactsExists) {
      await queryInterface.createTable('okr_new_impacts', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        objectiveId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'okr_new_objectives',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        text: {
          type: Sequelize.STRING(500),
          allowNull: false
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
      await queryInterface.addIndex('okr_new_impacts', ['objectiveId']);
    }

    // 5. Create okr_new_metric_templates
    const metricTemplatesExists = await queryInterface.tableExists('okr_new_metric_templates');
    if (!metricTemplatesExists) {
      await queryInterface.createTable('okr_new_metric_templates', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        module: {
          type: Sequelize.STRING(100), // Attendance, Recruitment, Projects, Probation, Leave
          allowNull: false
        },
        metricKey: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        title: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        unit: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        measurementType: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        direction: {
          type: Sequelize.STRING(50), // HIGHER_IS_BETTER, LOWER_IS_BETTER
          allowNull: false
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
      await queryInterface.addIndex('okr_new_metric_templates', ['module', 'metricKey'], {
        unique: true,
        name: 'idx_okr_metric_templates_unique'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('okr_new_metric_templates');
    await queryInterface.dropTable('okr_new_impacts');
    await queryInterface.dropTable('okr_new_check_ins');
    await queryInterface.dropTable('okr_new_key_results');
    await queryInterface.dropTable('okr_new_objectives');
  }
};
