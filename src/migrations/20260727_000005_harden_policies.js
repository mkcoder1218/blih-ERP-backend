'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableExists = await queryInterface.tableExists('policies');
    if (!tableExists) {
      await queryInterface.createTable('policies', {
        id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
        businessId: { type: Sequelize.UUID, allowNull: true },
        categoryId: { type: Sequelize.UUID, allowNull: true },
        policyType: { type: Sequelize.STRING(120), allowNull: false, defaultValue: 'GENERAL' },
        title: { type: Sequelize.STRING(255), allowNull: false },
        slug: { type: Sequelize.STRING(160), allowNull: false },
        summary: { type: Sequelize.TEXT, allowNull: true },
        contentHtml: { type: Sequelize.TEXT, allowNull: true },
        contentJson: { type: Sequelize.JSONB, allowNull: true },
        contentText: { type: Sequelize.TEXT, allowNull: true },
        version: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        versionLabel: { type: Sequelize.STRING(80), allowNull: true },
        status: { type: Sequelize.STRING(40), allowNull: false, defaultValue: 'draft' },
        visibility: { type: Sequelize.STRING(40), allowNull: false, defaultValue: 'company' },
        confidentialityLevel: { type: Sequelize.STRING(40), allowNull: false, defaultValue: 'normal' },
        isRequired: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        requiresAcceptance: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        requiresSignature: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        requiresReacceptanceOnUpdate: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        effectiveFrom: { type: Sequelize.DATE, allowNull: true },
        effectiveUntil: { type: Sequelize.DATE, allowNull: true },
        reviewDueAt: { type: Sequelize.DATE, allowNull: true },
        publishedAt: { type: Sequelize.DATE, allowNull: true },
        archivedAt: { type: Sequelize.DATE, allowNull: true },
        ownerUserId: { type: Sequelize.UUID, allowNull: true },
        ownerDepartmentId: { type: Sequelize.UUID, allowNull: true },
        createdById: { type: Sequelize.UUID, allowNull: true },
        updatedById: { type: Sequelize.UUID, allowNull: true },
        submittedByUserId: { type: Sequelize.UUID, allowNull: true },
        reviewedByUserId: { type: Sequelize.UUID, allowNull: true },
        approvedByUserId: { type: Sequelize.UUID, allowNull: true },
        publishedByUserId: { type: Sequelize.UUID, allowNull: true },
        archivedByUserId: { type: Sequelize.UUID, allowNull: true },
        submittedAt: { type: Sequelize.DATE, allowNull: true },
        reviewedAt: { type: Sequelize.DATE, allowNull: true },
        approvedAt: { type: Sequelize.DATE, allowNull: true },
        appliesToAllEmployees: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        publicShareEnabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        supersededByPolicyId: { type: Sequelize.UUID, allowNull: true },
        supersededByVersionId: { type: Sequelize.UUID, allowNull: true },
        acceptanceCount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        createdAt: { type: Sequelize.DATE, allowNull: false },
        updatedAt: { type: Sequelize.DATE, allowNull: false },
        deletedAt: { type: Sequelize.DATE, allowNull: true }
      });

      await queryInterface.addIndex('policies', ['businessId']);
      await queryInterface.addIndex('policies', ['categoryId']);
      await queryInterface.addIndex('policies', ['policyType', 'status']);
      await queryInterface.addIndex('policies', ['slug']);
      await queryInterface.addIndex('policies', ['status']);
      await queryInterface.addIndex('policies', ['visibility']);
      await queryInterface.addIndex('policies', ['ownerUserId']);
      await queryInterface.addIndex('policies', ['effectiveFrom']);
      await queryInterface.addIndex('policies', ['effectiveUntil']);
      await queryInterface.addIndex('policies', ['reviewDueAt']);
      await queryInterface.addIndex('policies', ['publishedAt']);
      return;
    }

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
    const tableExists = await queryInterface.tableExists('policies');
    if (!tableExists) {
      return;
    }

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
