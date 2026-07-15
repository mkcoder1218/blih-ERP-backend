'use strict';

const { db } = require('../dist/models');

async function main() {
  await db.sequelize.query(
    'ALTER TABLE business_attendance_settings ADD COLUMN IF NOT EXISTS "saturdayWorkMode" VARCHAR(30) NOT NULL DEFAULT \'PAID_DAY_OFF\';'
  );
  await db.sequelize.query(
    'ALTER TABLE business_attendance_settings ADD COLUMN IF NOT EXISTS "sundayWorkMode" VARCHAR(30) NOT NULL DEFAULT \'PAID_DAY_OFF\';'
  );
  console.log('weekend work mode columns ready');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await db.sequelize.close();
    } catch {}
  });
