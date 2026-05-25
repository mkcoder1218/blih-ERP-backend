
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
