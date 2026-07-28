import { JobDefinition } from "../../jobs/runner";
import { PolicyScheduler } from "./policy.scheduler";
import { db } from "../../models";
import { env } from "../../config/env";

const scheduler = new PolicyScheduler();

/**
 * Helper to run a background job with PostgreSQL Session Advisory Lock protection.
 * Uses a dedicated physical connection to acquire and release the advisory lock on the exact same session.
 */
export async function withPostgresAdvisoryLock(
  jobKey: string,
  handler: () => Promise<any>
): Promise<any> {
  const lockKeyInt = PolicyScheduler.hashKeyToBigInt(`policy-job:${jobKey}`);
  let connection: any = null;
  let lockAcquired = false;

  try {
    connection = await db.sequelize.connectionManager.getConnection({ type: 'write' });
    const res = await connection.query("SELECT pg_try_advisory_lock($1) AS acquired", [lockKeyInt]);
    lockAcquired = res && res.rows && res.rows[0] && (res.rows[0].acquired === true || res.rows[0].acquired === "true");

    if (!lockAcquired) {
      console.log(`[AdvisoryLock] Job "${jobKey}" skipped: lock contention on key ${lockKeyInt}`);
      await db.BackgroundJobLog.create({
        jobName: jobKey,
        jobType: "policy_maintenance",
        status: "skipped_locked",
        startedAt: new Date(),
        finishedAt: new Date(),
        metadata: { reason: "PostgreSQL advisory lock currently held by another worker process" }
      });
      return { skipped: true, reason: "skipped_locked" };
    }

    return await handler();
  } finally {
    if (connection && lockAcquired) {
      try {
        await connection.query("SELECT pg_advisory_unlock($1)", [lockKeyInt]);
      } catch (unlockErr: any) {
        console.error(`[AdvisoryLock] Unlock error for job "${jobKey}": ${unlockErr.message}`);
      }
    }
    if (connection) {
      try {
        await db.sequelize.connectionManager.releaseConnection(connection);
      } catch {}
    }
  }
}

export const policyPublishScheduledJob: JobDefinition = {
  name: "policy.publish-scheduled",
  type: "maintenance",
  cronExpression: env.policyPublishScheduledCron,
  handler: async () => {
    await withPostgresAdvisoryLock("policy.publish-scheduled", async () => {
      const result = await scheduler.processScheduledPolicies();
      console.log(`[policy.publish-scheduled] Executed: ${JSON.stringify(result)}`);
    });
  }
};

export const policyMarkOverdueJob: JobDefinition = {
  name: "policy.mark-overdue",
  type: "maintenance",
  cronExpression: env.policyOverdueCron,
  handler: async () => {
    await withPostgresAdvisoryLock("policy.mark-overdue", async () => {
      const result = await scheduler.processOverdueAcceptances();
      console.log(`[policy.mark-overdue] Executed: ${JSON.stringify(result)}`);
    });
  }
};

export const policySendRemindersJob: JobDefinition = {
  name: "policy.send-reminders",
  type: "notification",
  cronExpression: env.policyReminderCron,
  handler: async () => {
    await withPostgresAdvisoryLock("policy.send-reminders", async () => {
      const result = await scheduler.processPolicyReminders();
      console.log(`[policy.send-reminders] Executed: ${JSON.stringify(result)}`);
    });
  }
};
