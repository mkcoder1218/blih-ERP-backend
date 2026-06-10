"use strict";

/**
 * Migration: deduplicate business_settings rows and add unique constraint on (businessId, key).
 *
 * The settings service was calling `upsert` without a conflict target, so every save
 * created a new row. This migration:
 *   1. Keeps only the most recently updated row per (businessId, key)
 *   2. Adds a unique index on (businessId, key) so it can never happen again
 */
module.exports = {
  async up(queryInterface) {
    // Step 1: delete duplicates — keep the row with the latest updatedAt per (businessId, key)
    await queryInterface.sequelize.query(`
      DELETE FROM business_settings
      WHERE id NOT IN (
        SELECT DISTINCT ON ("businessId", key) id
        FROM business_settings
        WHERE "deletedAt" IS NULL
        ORDER BY "businessId", key, "updatedAt" DESC
      )
      AND "deletedAt" IS NULL;
    `);

    // Step 2: add unique index if not already present
    const indexes = await queryInterface.showIndex("business_settings");
    const alreadyExists = indexes.some(
      (i) => i.unique && i.fields && i.fields.length === 2 &&
              i.fields.some((f) => f.attribute === "businessId") &&
              i.fields.some((f) => f.attribute === "key")
    );

    if (!alreadyExists) {
      await queryInterface.addIndex("business_settings", ["businessId", "key"], {
        unique: true,
        name: "business_settings_businessId_key_unique",
        where: { deletedAt: null }, // partial index — only enforce on non-deleted rows
      });
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeIndex(
        "business_settings",
        "business_settings_businessId_key_unique"
      );
    } catch (_) {
      // ignore if it doesn't exist
    }
  },
};
