'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('policies');

    if (!tableInfo.categoryId) {
      await queryInterface.addColumn('policies', 'categoryId', {
        type: Sequelize.UUID,
        allowNull: true
      });
    }
    if (!tableInfo.confidentialityLevel) {
      await queryInterface.addColumn('policies', 'confidentialityLevel', {
        type: Sequelize.STRING(40),
        allowNull: false,
        defaultValue: 'normal'
      });
    }
    if (!tableInfo.visibility) {
      await queryInterface.addColumn('policies', 'visibility', {
        type: Sequelize.STRING(40),
        allowNull: false,
        defaultValue: 'company'
      });
    }
    if (!tableInfo.versionLabel) {
      await queryInterface.addColumn('policies', 'versionLabel', {
        type: Sequelize.STRING(80),
        allowNull: true
      });
    }
    if (!tableInfo.requiresAcceptance) {
      await queryInterface.addColumn('policies', 'requiresAcceptance', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
    }
    if (!tableInfo.requiresSignature) {
      await queryInterface.addColumn('policies', 'requiresSignature', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }
    if (!tableInfo.requiresReacceptanceOnUpdate) {
      await queryInterface.addColumn('policies', 'requiresReacceptanceOnUpdate', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
    }
    if (!tableInfo.effectiveFrom) {
      await queryInterface.addColumn('policies', 'effectiveFrom', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    if (!tableInfo.effectiveUntil) {
      await queryInterface.addColumn('policies', 'effectiveUntil', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    if (!tableInfo.reviewDueAt) {
      await queryInterface.addColumn('policies', 'reviewDueAt', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    if (!tableInfo.archivedAt) {
      await queryInterface.addColumn('policies', 'archivedAt', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    if (!tableInfo.ownerUserId) {
      await queryInterface.addColumn('policies', 'ownerUserId', {
        type: Sequelize.UUID,
        allowNull: true
      });
    }
    if (!tableInfo.ownerDepartmentId) {
      await queryInterface.addColumn('policies', 'ownerDepartmentId', {
        type: Sequelize.UUID,
        allowNull: true
      });
    }
    if (!tableInfo.submittedByUserId) {
      await queryInterface.addColumn('policies', 'submittedByUserId', {
        type: Sequelize.UUID,
        allowNull: true
      });
    }
    if (!tableInfo.reviewedByUserId) {
      await queryInterface.addColumn('policies', 'reviewedByUserId', {
        type: Sequelize.UUID,
        allowNull: true
      });
    }
    if (!tableInfo.approvedByUserId) {
      await queryInterface.addColumn('policies', 'approvedByUserId', {
        type: Sequelize.UUID,
        allowNull: true
      });
    }
    if (!tableInfo.publishedByUserId) {
      await queryInterface.addColumn('policies', 'publishedByUserId', {
        type: Sequelize.UUID,
        allowNull: true
      });
    }
    if (!tableInfo.archivedByUserId) {
      await queryInterface.addColumn('policies', 'archivedByUserId', {
        type: Sequelize.UUID,
        allowNull: true
      });
    }
    if (!tableInfo.submittedAt) {
      await queryInterface.addColumn('policies', 'submittedAt', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    if (!tableInfo.reviewedAt) {
      await queryInterface.addColumn('policies', 'reviewedAt', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    if (!tableInfo.approvedAt) {
      await queryInterface.addColumn('policies', 'approvedAt', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    if (!tableInfo.appliesToAllEmployees) {
      await queryInterface.addColumn('policies', 'appliesToAllEmployees', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      });
    }
    if (!tableInfo.publicShareEnabled) {
      await queryInterface.addColumn('policies', 'publicShareEnabled', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }
    if (!tableInfo.supersededByPolicyId) {
      await queryInterface.addColumn('policies', 'supersededByPolicyId', {
        type: Sequelize.UUID,
        allowNull: true
      });
    }
    if (!tableInfo.supersededByVersionId) {
      await queryInterface.addColumn('policies', 'supersededByVersionId', {
        type: Sequelize.UUID,
        allowNull: true
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('policies');
    const cols = [
      'categoryId', 'confidentialityLevel', 'visibility', 'versionLabel',
      'requiresAcceptance', 'requiresSignature', 'requiresReacceptanceOnUpdate',
      'effectiveFrom', 'effectiveUntil', 'reviewDueAt', 'archivedAt',
      'ownerUserId', 'ownerDepartmentId', 'submittedByUserId', 'reviewedByUserId',
      'approvedByUserId', 'publishedByUserId', 'archivedByUserId',
      'submittedAt', 'reviewedAt', 'approvedAt', 'appliesToAllEmployees',
      'publicShareEnabled', 'supersededByPolicyId', 'supersededByVersionId'
    ];

    for (const col of cols) {
      if (tableInfo[col]) {
        await queryInterface.removeColumn('policies', col);
      }
    }
  }
};
