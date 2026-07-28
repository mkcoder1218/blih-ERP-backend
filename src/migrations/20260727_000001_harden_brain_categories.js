'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Change default visibility to company if needed
    try {
      await queryInterface.changeColumn('brain_categories', 'visibility', {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'company',
      });
    } catch (e) {
      // Column may already exist or have constraints
    }

    // 2. Add indexes
    try {
      await queryInterface.addIndex('brain_categories', ['businessId'], {
        name: 'brain_categories_business_id_idx',
      });
    } catch (e) {}

    try {
      await queryInterface.addIndex('brain_categories', ['parentCategoryId'], {
        name: 'brain_categories_parent_category_id_idx',
      });
    } catch (e) {}

    try {
      await queryInterface.addIndex('brain_categories', ['status'], {
        name: 'brain_categories_status_idx',
      });
    } catch (e) {}

    try {
      await queryInterface.addIndex('brain_categories', ['businessId', 'key'], {
        name: 'brain_categories_business_id_key_unique',
        unique: true,
        where: { deletedAt: null },
      });
    } catch (e) {}
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeIndex('brain_categories', 'brain_categories_business_id_key_unique');
    } catch (e) {}
    try {
      await queryInterface.removeIndex('brain_categories', 'brain_categories_status_idx');
    } catch (e) {}
    try {
      await queryInterface.removeIndex('brain_categories', 'brain_categories_parent_category_id_idx');
    } catch (e) {}
    try {
      await queryInterface.removeIndex('brain_categories', 'brain_categories_business_id_idx');
    } catch (e) {}
  },
};
