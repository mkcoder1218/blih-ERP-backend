'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create eval_templates
    const templatesExists = await queryInterface.tableExists('eval_templates');
    if (!templatesExists) {
      await queryInterface.createTable('eval_templates', {
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
          type: Sequelize.STRING(100), // PERFORMANCE_REVIEW, KPI_ASSESSMENT, OKR_CHECK_IN, COMPETENCY_SURVEY, CUSTOM
          allowNull: false
        },
        targetAudience: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        frequency: {
          type: Sequelize.STRING(50), // ONE_TIME, MONTHLY, QUARTERLY, SEMI_ANNUAL, ANNUAL
          allowNull: false
        },
        status: {
          type: Sequelize.STRING(50), // DRAFT, ACTIVE, ARCHIVED
          allowNull: false,
          defaultValue: 'DRAFT'
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
      await queryInterface.addIndex('eval_templates', ['businessId']);
    }

    // 2. Create eval_sections
    const sectionsExists = await queryInterface.tableExists('eval_sections');
    if (!sectionsExists) {
      await queryInterface.createTable('eval_sections', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        businessId: {
          type: Sequelize.UUID,
          allowNull: false
        },
        templateId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'eval_templates',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        title: {
          type: Sequelize.STRING(255),
          allowNull: false
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        orderIndex: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
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
      await queryInterface.addIndex('eval_sections', ['businessId']);
      await queryInterface.addIndex('eval_sections', ['templateId']);
    }

    // 3. Create eval_questions
    const questionsExists = await queryInterface.tableExists('eval_questions');
    if (!questionsExists) {
      await queryInterface.createTable('eval_questions', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        businessId: {
          type: Sequelize.UUID,
          allowNull: false
        },
        sectionId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'eval_sections',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        type: {
          type: Sequelize.STRING(50), // TEXT, TEXTAREA, NUMBER, RATING, SINGLE_SELECT, MULTI_SELECT, BOOLEAN, DATE, KPI_REFERENCE, OKR_REFERENCE
          allowNull: false
        },
        label: {
          type: Sequelize.STRING(500),
          allowNull: false
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        isRequired: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        options: {
          type: Sequelize.JSONB,
          allowNull: true
        },
        validationRules: {
          type: Sequelize.JSONB,
          allowNull: true
        },
        scoreWeight: {
          type: Sequelize.FLOAT,
          allowNull: false,
          defaultValue: 1.0
        },
        orderIndex: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
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
      await queryInterface.addIndex('eval_questions', ['businessId']);
      await queryInterface.addIndex('eval_questions', ['sectionId']);
    }

    // 4. Create eval_assignments
    const assignmentsExists = await queryInterface.tableExists('eval_assignments');
    if (!assignmentsExists) {
      await queryInterface.createTable('eval_assignments', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        businessId: {
          type: Sequelize.UUID,
          allowNull: false
        },
        templateId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'eval_templates',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        targetType: {
          type: Sequelize.STRING(50), // EMPLOYEE, DEPARTMENT, ROLE
          allowNull: false
        },
        targetId: {
          type: Sequelize.UUID,
          allowNull: true
        },
        evaluatorType: {
          type: Sequelize.STRING(50), // SELF, MANAGER, PEER, HR, DEPARTMENT_HEAD, CUSTOM
          allowNull: false
        },
        evaluatorUserId: {
          type: Sequelize.UUID,
          allowNull: false
        },
        participantUserId: {
          type: Sequelize.UUID,
          allowNull: false
        },
        dueDate: {
          type: Sequelize.DATEONLY,
          allowNull: false
        },
        status: {
          type: Sequelize.STRING(50), // PENDING, IN_PROGRESS, SUBMITTED, OVERDUE, CANCELLED
          allowNull: false,
          defaultValue: 'PENDING'
        },
        templateSnapshot: {
          type: Sequelize.JSONB,
          allowNull: false
        },
        completedAt: {
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
        }
      });
      await queryInterface.addIndex('eval_assignments', ['businessId']);
      await queryInterface.addIndex('eval_assignments', ['templateId']);
      await queryInterface.addIndex('eval_assignments', ['evaluatorUserId']);
      await queryInterface.addIndex('eval_assignments', ['participantUserId']);
    }

    // 5. Create eval_responses
    const responsesExists = await queryInterface.tableExists('eval_responses');
    if (!responsesExists) {
      await queryInterface.createTable('eval_responses', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        businessId: {
          type: Sequelize.UUID,
          allowNull: false
        },
        assignmentId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'eval_assignments',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        templateId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'eval_templates',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        submitterUserId: {
          type: Sequelize.UUID,
          allowNull: false
        },
        status: {
          type: Sequelize.STRING(50), // SUBMITTED, DRAFT
          allowNull: false,
          defaultValue: 'DRAFT'
        },
        score: {
          type: Sequelize.FLOAT,
          allowNull: true
        },
        submittedAt: {
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
        }
      });
      await queryInterface.addIndex('eval_responses', ['businessId']);
      await queryInterface.addIndex('eval_responses', ['assignmentId']);
    }

    // 6. Create eval_answers
    const answersExists = await queryInterface.tableExists('eval_answers');
    if (!answersExists) {
      await queryInterface.createTable('eval_answers', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        businessId: {
          type: Sequelize.UUID,
          allowNull: false
        },
        responseId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'eval_responses',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        questionId: {
          type: Sequelize.UUID,
          allowNull: false,
          references: {
            model: 'eval_questions',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        textValue: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        numberValue: {
          type: Sequelize.FLOAT,
          allowNull: true
        },
        dateValue: {
          type: Sequelize.DATEONLY,
          allowNull: true
        },
        optionValues: {
          type: Sequelize.JSONB,
          allowNull: true
        },
        kpiValue: {
          type: Sequelize.FLOAT,
          allowNull: true
        },
        okrValue: {
          type: Sequelize.FLOAT,
          allowNull: true
        },
        referencedKpiId: {
          type: Sequelize.UUID,
          allowNull: true
        },
        referencedObjectiveId: {
          type: Sequelize.UUID,
          allowNull: true
        },
        referencedKeyResultId: {
          type: Sequelize.UUID,
          allowNull: true
        },
        capturedValue: {
          type: Sequelize.FLOAT,
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
      await queryInterface.addIndex('eval_answers', ['businessId']);
      await queryInterface.addIndex('eval_answers', ['responseId']);
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('eval_answers');
    await queryInterface.dropTable('eval_responses');
    await queryInterface.dropTable('eval_assignments');
    await queryInterface.dropTable('eval_questions');
    await queryInterface.dropTable('eval_sections');
    await queryInterface.dropTable('eval_templates');
  }
};
