'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.addIndex('brain_revisions', ['articleId', 'version'], {
        name: 'brain_revisions_article_id_version_unique',
        unique: true,
      });
    } catch (e) {}
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeIndex('brain_revisions', 'brain_revisions_article_id_version_unique');
    } catch (e) {}
  },
};
