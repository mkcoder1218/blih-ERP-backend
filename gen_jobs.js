const fs = require('fs');
const path = require('path');

const src = path.join(process.cwd(), 'src');
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

ensureDir(path.join(src, 'jobs', 'handlers'));

// -- Update Env --
const envPath = path.join(src, 'config', 'env.ts');
let envContent = fs.readFileSync(envPath, 'utf8');

if (!envContent.includes('jobWorkerEnabled')) {
  envContent = envContent.replace('export type Env = {', 'export type Env = {\n  jobWorkerEnabled: boolean;\n  jobTimezone: string;');
  envContent = envContent.replace('export const env: Env = {', 'export const env: Env = {\n  jobWorkerEnabled: toBool(process.env.JOB_WORKER_ENABLED, false),\n  jobTimezone: process.env.JOB_TIMEZONE || "UTC",');
  fs.writeFileSync(envPath, envContent);
}

// -- Runner --
fs.writeFileSync(path.join(src, 'jobs', 'runner.ts'), `
import cron from 'node-cron';
import { env } from '../config/env';
import { db } from '../models';

const activeJobs = new Set<string>();

export interface JobDefinition {
  name: string;
  type: string;
  cronExpression: string;
  handler: () => Promise<void>;
  enabled?: boolean;
}

export class JobRunner {
  static register(job: JobDefinition) {
    if (job.enabled === false) return;
    
    cron.schedule(job.cronExpression, async () => {
      if (activeJobs.has(job.name)) {
         console.log(\`Job \${job.name} skipped: already running.\`);
         return;
      }
      activeJobs.add(job.name);
      
      const log = await db.BackgroundJobLog.create({
         jobName: job.name,
         jobType: job.type,
         status: 'running',
         startedAt: new Date(),
         attempts: 1
      });

      try {
        await job.handler();
        await log.update({
           status: 'success',
           finishedAt: new Date()
        });
      } catch (err: any) {
        console.error(\`Job \${job.name} failed: \${err.message}\`);
        await log.update({
           status: 'failed',
           finishedAt: new Date(),
           errorMessage: err.message
        });
      } finally {
        activeJobs.delete(job.name);
      }
    }, {
      timezone: env.jobTimezone
    });
    console.log(\`Job registered: \${job.name} (\${job.cronExpression})\`);
  }
}
`);

// -- Handlers --
// 1. Approval
fs.writeFileSync(path.join(src, 'jobs', 'handlers', 'approvalDeadlineReminder.ts'), `
import { JobDefinition } from '../runner';
import { db } from '../../models';

export const approvalDeadlineReminder: JobDefinition = {
  name: 'ApprovalDeadlineReminder',
  type: 'notification',
  cronExpression: '0 8 * * *', // Daily at 8 AM
  handler: async () => {
     // Mock logic to scan pending approvals crossing deadline
     // In an actual scenario this limits search to active businessIds and un-suspended
     const pendingApprovals = await db.ApprovalRequest.findAll({
        where: { status: 'pending' },
        include: [{ model: db.Business }] // requires checking business active sub ideally
     });
     // Iterate and push notification triggers mock
  }
};
`);

// 2. Overdue Invoice
fs.writeFileSync(path.join(src, 'jobs', 'handlers', 'overdueInvoiceReminder.ts'), `
import { JobDefinition } from '../runner';
import { db } from '../../models';

export const overdueInvoiceReminder: JobDefinition = {
  name: 'OverdueInvoiceReminder',
  type: 'billing',
  cronExpression: '0 8 * * *',
  handler: async () => {
     // Mock scan subscription or finance invoices
  }
};
`);

// 3. Subscription Expiry Check
fs.writeFileSync(path.join(src, 'jobs', 'handlers', 'subscriptionExpiryCheck.ts'), `
import { JobDefinition } from '../runner';
import { db } from '../../models';
import { Op } from 'sequelize';

export const subscriptionExpiryCheck: JobDefinition = {
  name: 'SubscriptionExpiryCheck',
  type: 'billing',
  cronExpression: '0 0 * * *', // Midnight
  handler: async () => {
     const now = new Date();
     await db.Subscription.update(
        { status: 'expired' },
        { where: { endDate: { [Op.lt]: now }, status: 'active' } }
     );
  }
};
`);

// 4. Trial Expiry Reminder
fs.writeFileSync(path.join(src, 'jobs', 'handlers', 'trialExpiryReminder.ts'), `
import { JobDefinition } from '../runner';
import { db } from '../../models';

export const trialExpiryReminder: JobDefinition = {
  name: 'TrialExpiryReminder',
  type: 'billing',
  cronExpression: '0 9 * * *',
  handler: async () => {
     // Send notifications to trials expiring in < 3 days
  }
};
`);

// 5. Scheduled Report Runner
fs.writeFileSync(path.join(src, 'jobs', 'handlers', 'scheduledReportRunner.ts'), `
import { JobDefinition } from '../runner';
import { db } from '../../models';

export const scheduledReportRunner: JobDefinition = {
  name: 'ScheduledReportRunner',
  type: 'report',
  cronExpression: '0 * * * *', // Hourly sweep
  handler: async () => {
      // Find ReportDefinitions with schedule configurations that match current hour
  }
};
`);

// 6. Inactive User Cleanup 
fs.writeFileSync(path.join(src, 'jobs', 'handlers', 'inactiveUserCleanupCheck.ts'), `
import { JobDefinition } from '../runner';
import { db } from '../../models';

export const inactiveUserCleanupCheck: JobDefinition = {
  name: 'InactiveUserCleanupCheck',
  type: 'maintenance',
  cronExpression: '0 2 * * 0', // Weekly sunday 2am
  handler: async () => {
     // Disable users inactive > 90 days
  }
};
`);

// -- Registry --
fs.writeFileSync(path.join(src, 'jobs', 'registry.ts'), `
import { JobRunner } from './runner';
import { env } from '../config/env';

import { approvalDeadlineReminder } from './handlers/approvalDeadlineReminder';
import { overdueInvoiceReminder } from './handlers/overdueInvoiceReminder';
import { subscriptionExpiryCheck } from './handlers/subscriptionExpiryCheck';
import { trialExpiryReminder } from './handlers/trialExpiryReminder';
import { scheduledReportRunner } from './handlers/scheduledReportRunner';
import { inactiveUserCleanupCheck } from './handlers/inactiveUserCleanupCheck';

export function initJobs() {
   if (!env.jobWorkerEnabled) {
      console.log('Background job worker is DISABLED.');
      return;
   }
   console.log('Initializing Background Job Worker...');

   JobRunner.register(approvalDeadlineReminder);
   JobRunner.register(overdueInvoiceReminder);
   JobRunner.register(subscriptionExpiryCheck);
   JobRunner.register(trialExpiryReminder);
   JobRunner.register(scheduledReportRunner);
   JobRunner.register(inactiveUserCleanupCheck);
}
`);

// -- Patch index.ts entry --
const indexPath = path.join(src, 'index.ts');
let indexContent = fs.readFileSync(indexPath, 'utf8');

if (!indexContent.includes('initJobs')) {
   indexContent = indexContent.replace("import { db } from './models';", "import { db } from './models';\nimport { initJobs } from './jobs/registry';");
   indexContent = indexContent.replace("server.listen(env.port", "initJobs();\n  server.listen(env.port");
   fs.writeFileSync(indexPath, indexContent);
}

console.log('Background Jobs Scaffolding Created.');
