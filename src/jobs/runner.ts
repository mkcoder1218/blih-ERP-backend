
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
         console.log(`Job ${job.name} skipped: already running.`);
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
        console.error(`Job ${job.name} failed: ${err.message}`);
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
    console.log(`Job registered: ${job.name} (${job.cronExpression})`);
  }
}
