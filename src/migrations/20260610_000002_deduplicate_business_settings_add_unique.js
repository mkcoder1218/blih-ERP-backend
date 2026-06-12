"use strict";

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

/**
 * Migration: deduplicate business_settings rows and add a unique constraint on
 * (businessId, key).
 *
 * Older deployments may not have the paranoid deletedAt column yet, so this
 * migration inspects the table shape before building the delete query/index.
 */
module.exports = {
  async up(queryInterface) {
    if (!(await tableExists(queryInterface, "business_settings"))) {
      return;
    }

    const table = await queryInterface.describeTable("business_settings");
    const hasDeletedAt = Boolean(table.deletedAt);
    const activeRowFilter = hasDeletedAt ? 'WHERE "deletedAt" IS NULL' : "";
    const duplicateFilter = hasDeletedAt ? 'AND "deletedAt" IS NULL' : "";

    await queryInterface.sequelize.query(`
      DELETE FROM business_settings
      WHERE id NOT IN (
        SELECT DISTINCT ON ("businessId", key) id
        FROM business_settings
        ${activeRowFilter}
        ORDER BY "businessId", key, "updatedAt" DESC
      )
      ${duplicateFilter};
    `);

    const indexes = await queryInterface.showIndex("business_settings");
    const alreadyExists = indexes.some(
      (i) => i.unique && i.fields && i.fields.length === 2 &&
        i.fields.some((f) => f.attribute === "businessId") &&
        i.fields.some((f) => f.attribute === "key")
    );

    if (!alreadyExists) {
      const options = {
        unique: true,
        name: "business_settings_businessId_key_unique",
      };

      if (hasDeletedAt) {
        options.where = { deletedAt: null };
      }

      await queryInterface.addIndex("business_settings", ["businessId", "key"], options);
    }
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface, "business_settings"))) {
      return;
    }

    try {
      await queryInterface.removeIndex(
        "business_settings",
        "business_settings_businessId_key_unique"
      );
    } catch (_) {
      // Ignore if it does not exist.
    }
  },
};
