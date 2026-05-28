
const { db } = require('./src/models');

async function sync() {
    try {
        console.log("Checking for views column in hr_job_openings...");
        await db.sequelize.query('ALTER TABLE hr_job_openings ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;');
        console.log("Column 'views' added successfully (if it didn't exist).");
        
        console.log("Checking for Interview table columns...");
        await db.sequelize.query('ALTER TABLE hr_interviews ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 60;');
        await db.sequelize.query('ALTER TABLE hr_interviews ADD COLUMN IF NOT EXISTS type VARCHAR(255) DEFAULT \'Face to Face\';');
        await db.sequelize.query('ALTER TABLE hr_interviews ADD COLUMN IF NOT EXISTS venue VARCHAR(255);');
        await db.sequelize.query('ALTER TABLE hr_interviews ADD COLUMN IF NOT EXISTS panel JSONB DEFAULT \'[]\';');
        await db.sequelize.query('ALTER TABLE hr_interviews ADD COLUMN IF NOT EXISTS questions JSONB DEFAULT \'[]\';');
        await db.sequelize.query('ALTER TABLE hr_interviews ADD COLUMN IF NOT EXISTS "additionalNotes" TEXT;');
        console.log("Interview table updated successfully.");
        
        process.exit(0);
    } catch (e) {
        console.error("Sync failed:", e);
        process.exit(1);
    }
}

sync();
