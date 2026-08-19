'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create kpis
    const kpisExists = await queryInterface.tableExists('kpis');
    if (!kpisExists) {
      await queryInterface.createTable('kpis', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        businessId: {
          type: Sequelize.UUID,
          allowNull: false
        },
        title: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        category: {
          type: Sequelize.STRING(100),
          allowNull: false
        },
        ownerType: {
          type: Sequelize.STRING(50), // COMPANY, DEPARTMENT, TEAM, EMPLOYEE
          allowNull: false
        },
        ownerId: {
          type: Sequelize.UUID,
          allowNull: true
        },
        measurementType: {
          type: Sequelize.STRING(50), // PERCENTAGE, NUMBER, DURATION
          allowNull: false
        },
        unit: {
          type: Sequelize.STRING(50),
          allowNull: false
        },
        direction: {
          type: Sequelize.STRING(50), // INCREASE, DECREASE
          allowNull: false
        },
        baselineValue: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 0.0
        },
        currentValue: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 0.0
        },
        targetValue: {
          type: Sequelize.FLOAT,
          allowNull: false
        },
        updateFrequency: {
          type: Sequelize.STRING(50), // WEEKLY, MONTHLY, QUARTERLY, ANNUAL
          allowNull: false
        },
        trackingType: {
          type: Sequelize.STRING(50), // AUTOMATIC, MANUAL
          allowNull: false
        },
        moduleSelector: {
          type: Sequelize.STRING(100),
          allowNull: true
        },
        metricSelector: {
          type: Sequelize.STRING(100),
          allowNull: true
        },
        status: {
          type: Sequelize.STRING(50), // EXCEEDING_TARGET, ON_TARGET, BELOW_TARGET
          allowNull: false,
          defaultValue: 'ON_TARGET'
        },
        isActive: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true
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
      await queryInterface.addIndex('kpis', ['businessId']);
      await queryInterface.addIndex('kpis', ['ownerType', 'ownerId']);
    }

    // 2. Create kpi_value_history
    const historyExists = await queryInterface.tableExists('kpi_value_history');
    if (!historyExists) {
      await queryInterface.createTable('kpi_value_history', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        businessId: {
          type: Sequelize.UUID,
          allowNull: false
        },
        kpiId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'kpis',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        value: {
          type: Sequelize.FLOAT,
          allowNull: false
        },
        previousValue: {
          type: Sequelize.FLOAT,
          allowNull: true
        },
        source: {
          type: Sequelize.STRING(50), // MANUAL, AUTOMATIC
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
        calculatedAt: {
          type: Sequelize.DATE,
          allowNull: false
        },
        calculationMetadata: {
          type: Sequelize.JSONB,
          allowNull: true
        },
        createdById: {
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
      await queryInterface.addIndex('kpi_value_history', ['businessId']);
      await queryInterface.addIndex('kpi_value_history', ['kpiId']);
    }

    // 3. Create kpi_metric_templates
    const templatesExists = await queryInterface.tableExists('kpi_metric_templates');
    if (!templatesExists) {
      await queryInterface.createTable('kpi_metric_templates', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        module: {
          type: Sequelize.STRING(100),
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
          type: Sequelize.STRING(50), // INCREASE, DECREASE
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
      await queryInterface.addIndex('kpi_metric_templates', ['module', 'metricKey'], {
        unique: true,
        name: 'idx_kpi_templates_module_key_unique'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('kpi_metric_templates');
    await queryInterface.dropTable('kpi_value_history');
    await queryInterface.dropTable('kpis');
  }
};
