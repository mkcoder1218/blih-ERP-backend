'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDescription = await queryInterface.describeTable('brain_articles');

    const columnsToAdd = [
      ['contentText', { type: Sequelize.TEXT, allowNull: true }],
      ['submittedAt', { type: Sequelize.DATE, allowNull: true }],
      ['submittedByUserId', { type: Sequelize.UUID, allowNull: true }],
      ['reviewedAt', { type: Sequelize.DATE, allowNull: true }],
      ['reviewedByUserId', { type: Sequelize.UUID, allowNull: true }],
      ['publishedByUserId', { type: Sequelize.UUID, allowNull: true }],
      ['archivedAt', { type: Sequelize.DATE, allowNull: true }],
      ['archivedByUserId', { type: Sequelize.UUID, allowNull: true }],
    ];

    for (const [colName, colSpec] of columnsToAdd) {
      if (!tableDescription[colName]) {
        await queryInterface.addColumn('brain_articles', colName, colSpec);
      }
    }

    // Convert internal -> company
    await queryInterface.sequelize.query(
      `UPDATE "brain_articles" SET "visibility" = 'company' WHERE "visibility" = 'internal';`
    );

    // Populate contentText for existing articles by stripping HTML tags
    await queryInterface.sequelize.query(
      `UPDATE "brain_articles" SET "contentText" = regexp_replace("content", '<[^>]*>', '', 'g') WHERE "contentText" IS NULL AND "content" IS NOT NULL;`
    );

    // Add indexes
    const indexes = [
      { name: 'brain_articles_business_id_idx', fields: ['businessId'] },
      { name: 'brain_articles_business_id_status_idx', fields: ['businessId', 'status'] },
      { name: 'brain_articles_business_id_category_id_idx', fields: ['businessId', 'categoryId'] },
      { name: 'brain_articles_business_id_author_user_id_idx', fields: ['businessId', 'authorUserId'] },
      { name: 'brain_articles_business_id_visibility_idx', fields: ['businessId', 'visibility'] },
      { name: 'brain_articles_updated_at_idx', fields: ['updatedAt'] },
    ];

    for (const idx of indexes) {
      try {
        await queryInterface.addIndex('brain_articles', idx.fields, { name: idx.name });
      } catch (e) {}
    }

    try {
      await queryInterface.addIndex('brain_articles', ['businessId', 'slug'], {
        name: 'brain_articles_business_id_slug_unique',
        unique: true,
        where: { deletedAt: null },
      });
    } catch (e) {}
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeIndex('brain_articles', 'brain_articles_business_id_slug_unique');
    } catch (e) {}
  },
};
