"use strict";

const { randomUUID } = require("crypto");

module.exports = {
  async up(queryInterface, Sequelize) {
    const [businesses] = await queryInterface.sequelize.query(`
      SELECT b.id
      FROM businesses b
      WHERE NOT EXISTS (
        SELECT 1
        FROM business_modules bm
        WHERE bm."businessId" = b.id
          AND bm."moduleKey" = 'finance'
      );
    `);

    if (businesses.length) {
      const now = new Date();
      await queryInterface.bulkInsert("business_modules", businesses.map((business) => ({
        id: randomUUID(),
        businessId: business.id,
        moduleKey: "finance",
        moduleName: "Workforce Finance",
        status: "active",
        settings: JSON.stringify({}),
        enabledAt: now,
        createdAt: now,
        updatedAt: now
      })));
    }

    await queryInterface.sequelize.query(`
      UPDATE business_modules
      SET "status" = 'active',
          "moduleName" = COALESCE(NULLIF("moduleName", ''), 'Workforce Finance'),
          "enabledAt" = COALESCE("enabledAt", NOW()),
          "disabledAt" = NULL,
          "updatedAt" = NOW()
      WHERE "moduleKey" = 'finance'
        AND "status" <> 'active';
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE business_modules
      SET "status" = 'inactive',
          "disabledAt" = NOW(),
          "updatedAt" = NOW()
      WHERE "moduleKey" = 'finance'
        AND "moduleName" = 'Workforce Finance';
    `);
  }
};
