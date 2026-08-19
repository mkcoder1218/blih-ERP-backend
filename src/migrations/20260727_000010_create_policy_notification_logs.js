'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableExists = await queryInterface.tableExists('policy_notification_logs');
    if (!tableExists) {
      await queryInterface.createTable('policy_notification_logs', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true
        },
        businessId: {
          type: Sequelize.UUID,
          allowNull: false
        },
        jobKey: {
          type: Sequelize.STRING(120),
          allowNull: false
        },
        reminderType: {
          type: Sequelize.STRING(80),
          allowNull: false
        },
        reminderWindow: {
          type: Sequelize.STRING(40),
          allowNull: false
        },
        recipientUserId: {
          type: Sequelize.UUID,
          allowNull: false
        },
        resourceId: {
          type: Sequelize.UUID,
          allowNull: false
        },
        policyVersionId: {
          type: Sequelize.UUID,
          allowNull: true
        },
        acceptanceId: {
          type: Sequelize.UUID,
          allowNull: true
        },
        status: {
          type: Sequelize.STRING(40),
          allowNull: false,
          defaultValue: 'delivered'
        },
        errorMessage: {
          type: Sequelize.TEXT,
          allowNull: true
        },
        dedupKey: {
          type: Sequelize.STRING(255),
          allowNull: false,
          unique: true
        },
        sentAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });

      await queryInterface.addIndex('policy_notification_logs', ['dedupKey'], {
        unique: true,
        name: 'idx_policy_notification_logs_dedup_unique'
      });
      await queryInterface.addIndex('policy_notification_logs', ['businessId']);
      await queryInterface.addIndex('policy_notification_logs', ['recipientUserId']);
      await queryInterface.addIndex('policy_notification_logs', ['resourceId']);
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableExists = await queryInterface.tableExists('policy_notification_logs');
    if (tableExists) {
      await queryInterface.dropTable('policy_notification_logs');
    }
  }
};
