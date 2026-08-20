"use strict";

const { randomUUID } = require("crypto");

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "businesses")) || !(await tableExists(queryInterface, "business_modules"))) {
      return;
    }

    const [businesses] = await queryInterface.sequelize.query(`
      SELECT b.id
      FROM businesses b
      WHERE NOT EXISTS (
        SELECT 1
        FROM business_modules bm
        WHERE bm."businessId" = b.id
          AND bm."moduleKey" = 'procedures'
      );
    `);

    if (businesses.length) {
      const now = new Date();
      await queryInterface.bulkInsert("business_modules", businesses.map((business) => ({
        id: randomUUID(),
        businessId: business.id,
        moduleKey: "procedures",
        moduleName: "Company Procedures",
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
          "moduleName" = COALESCE(NULLIF("moduleName", ''), 'Company Procedures'),
          "enabledAt" = COALESCE("enabledAt", NOW()),
          "disabledAt" = NULL,
          "updatedAt" = NOW()
      WHERE "moduleKey" = 'procedures'
        AND "status" <> 'active';
    `);
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface, "business_modules"))) {
      return;
    }

    await queryInterface.sequelize.query(`
      UPDATE business_modules
      SET "status" = 'inactive',
          "disabledAt" = NOW(),
          "updatedAt" = NOW()
      WHERE "moduleKey" = 'procedures'
        AND "moduleName" = 'Company Procedures';
    `);
  }
};
