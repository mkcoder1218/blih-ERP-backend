import { JobRunner } from "../../jobs/runner";
import { env } from "../../config/env";
import {
  policyPublishScheduledJob,
  policyMarkOverdueJob,
  policySendRemindersJob
} from "./policy.job-handler";

export function shouldRegisterPolicyJobs(
  jobWorkerEnabled = env.jobWorkerEnabled,
  policyJobsEnabled = env.policyJobsEnabled
): boolean {
  return Boolean(jobWorkerEnabled && policyJobsEnabled);
}

export function registerPolicyJobs(): boolean {
  if (!shouldRegisterPolicyJobs()) {
    console.log(`Policy background jobs skipped: JOB_WORKER_ENABLED=${env.jobWorkerEnabled}, POLICY_JOBS_ENABLED=${env.policyJobsEnabled}`);
    return false;
  }

  console.log("Registering Policy Background Jobs...");
  JobRunner.register(policyPublishScheduledJob);
  JobRunner.register(policyMarkOverdueJob);
  JobRunner.register(policySendRemindersJob);

  return true;
}
