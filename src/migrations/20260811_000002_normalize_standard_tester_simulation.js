"use strict";

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.includes(tableName);
}

module.exports = {
  async up(queryInterface) {
    if (!(await tableExists(queryInterface, "tester_accounts"))) return;

    if (await tableExists(queryInterface, "business_user_profiles")) {
      await queryInterface.sequelize.query(`
        UPDATE business_user_profiles AS profile
        SET
          "employmentType" = 'full_time',
          "status" = 'active',
          "updatedAt" = NOW()
        FROM tester_accounts AS tester
        WHERE tester."userId" = profile."userId"
          AND tester."testerLevel" = 'STANDARD'
      `);
    }

    if (await tableExists(queryInterface, "hr_employee_records")) {
      await queryInterface.sequelize.query(`
        UPDATE hr_employee_records AS employee
        SET
          "employmentType" = 'full_time',
          "employmentCategory" = NULL,
          "employmentStatus" = 'active',
          "metadata" = COALESCE(employee."metadata", '{}'::jsonb)
            || '{"isTestAccount":true,"excludeFromReporting":true,"simulatedAsRealEmployee":true}'::jsonb,
          "updatedAt" = NOW()
        FROM tester_accounts AS tester
        WHERE tester."userId" = employee."userId"
          AND tester."testerLevel" = 'STANDARD'
      `);
    }
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface, "tester_accounts"))) return;

    if (await tableExists(queryInterface, "business_user_profiles")) {
      await queryInterface.sequelize.query(`
        UPDATE business_user_profiles AS profile
        SET
          "employmentType" = 'tester',
          "updatedAt" = NOW()
        FROM tester_accounts AS tester
        WHERE tester."userId" = profile."userId"
          AND tester."testerLevel" = 'STANDARD'
      `);
    }

    if (await tableExists(queryInterface, "hr_employee_records")) {
      await queryInterface.sequelize.query(`
        UPDATE hr_employee_records AS employee
        SET
          "employmentType" = 'tester',
          "employmentCategory" = 'test',
          "employmentStatus" = 'TEST',
          "updatedAt" = NOW()
        FROM tester_accounts AS tester
        WHERE tester."userId" = employee."userId"
          AND tester."testerLevel" = 'STANDARD'
      `);
    }
  },
};
