'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('policy_acceptances');

    if (!tableInfo.policyVersionId) {
      await queryInterface.addColumn('policy_acceptances', 'policyVersionId', {
        type: Sequelize.UUID,
        allowNull: true
      });
    }
    if (!tableInfo.employeeId) {
      await queryInterface.addColumn('policy_acceptances', 'employeeId', {
        type: Sequelize.UUID,
        allowNull: true
      });
    }
    if (!tableInfo.status) {
      await queryInterface.addColumn('policy_acceptances', 'status', {
        type: Sequelize.STRING(40),
        allowNull: false,
        defaultValue: 'accepted'
      });
    }
    if (!tableInfo.assignedAt) {
      await queryInterface.addColumn('policy_acceptances', 'assignedAt', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      });
    }
    if (!tableInfo.dueAt) {
      await queryInterface.addColumn('policy_acceptances', 'dueAt', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    if (!tableInfo.viewedAt) {
      await queryInterface.addColumn('policy_acceptances', 'viewedAt', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    if (!tableInfo.signedAt) {
      await queryInterface.addColumn('policy_acceptances', 'signedAt', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    if (!tableInfo.revokedAt) {
      await queryInterface.addColumn('policy_acceptances', 'revokedAt', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    if (!tableInfo.acceptanceMethod) {
      await queryInterface.addColumn('policy_acceptances', 'acceptanceMethod', {
        type: Sequelize.STRING(40),
        allowNull: true
      });
    }
    if (!tableInfo.signatureType) {
      await queryInterface.addColumn('policy_acceptances', 'signatureType', {
        type: Sequelize.STRING(40),
        allowNull: true
      });
    }
    if (!tableInfo.typedSignatureName) {
      await queryInterface.addColumn('policy_acceptances', 'typedSignatureName', {
        type: Sequelize.STRING(255),
        allowNull: true
      });
    }
    if (!tableInfo.signatureAttachmentId) {
      await queryInterface.addColumn('policy_acceptances', 'signatureAttachmentId', {
        type: Sequelize.UUID,
        allowNull: true
      });
    }
    if (!tableInfo.signatureStrokeData) {
      await queryInterface.addColumn('policy_acceptances', 'signatureStrokeData', {
        type: Sequelize.JSONB,
        allowNull: true
      });
    }
    if (!tableInfo.signatureHash) {
      await queryInterface.addColumn('policy_acceptances', 'signatureHash', {
        type: Sequelize.STRING(64),
        allowNull: true
      });
    }
    if (!tableInfo.ipAddress) {
      await queryInterface.addColumn('policy_acceptances', 'ipAddress', {
        type: Sequelize.STRING(80),
        allowNull: true
      });
    }
    if (!tableInfo.userAgent) {
      await queryInterface.addColumn('policy_acceptances', 'userAgent', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }
    if (!tableInfo.acceptedContentHash) {
      await queryInterface.addColumn('policy_acceptances', 'acceptedContentHash', {
        type: Sequelize.STRING(64),
        allowNull: true
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('policy_acceptances');
    const cols = [
      'policyVersionId', 'employeeId', 'status', 'assignedAt', 'dueAt',
      'viewedAt', 'signedAt', 'revokedAt', 'acceptanceMethod', 'signatureType',
      'typedSignatureName', 'signatureAttachmentId', 'signatureStrokeData',
      'signatureHash', 'ipAddress', 'userAgent', 'acceptedContentHash'
    ];

    for (const col of cols) {
      if (tableInfo[col]) {
        await queryInterface.removeColumn('policy_acceptances', col);
      }
    }
  }
};
