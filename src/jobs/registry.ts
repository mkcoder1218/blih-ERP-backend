
import { JobRunner } from './runner';
import { env } from '../config/env';

import { approvalDeadlineReminder } from './handlers/approvalDeadlineReminder';
import { overdueInvoiceReminder } from './handlers/overdueInvoiceReminder';
import { subscriptionExpiryCheck } from './handlers/subscriptionExpiryCheck';
import { trialExpiryReminder } from './handlers/trialExpiryReminder';
import { scheduledReportRunner } from './handlers/scheduledReportRunner';
import { inactiveUserCleanupCheck } from './handlers/inactiveUserCleanupCheck';
import { telegramAttendanceSummary } from './handlers/telegramAttendanceSummary';
import { telegramPersonalBotPoller } from './handlers/telegramPersonalBotPoller';
import { telegramDatabaseBackup } from './handlers/telegramDatabaseBackup';
import { googleCalendarImportSync } from './handlers/googleCalendarImportSync';
import { googleCalendarWatchRenewal } from './handlers/googleCalendarWatchRenewal';
import { googleCalendarSyncRetry } from './handlers/googleCalendarSyncRetry';
import { probationCompletionNotifier } from './handlers/probationCompletionNotifier';
import { employmentChangeEffectiveDate } from './handlers/employmentChangeEffectiveDate';
import { registerPolicyJobs } from '../modules/policy/policy.job-registration';

export function initJobs() {
   console.log(`Background job worker flag: ${env.jobWorkerEnabled ? 'ENABLED' : 'DISABLED'} (timezone: ${env.jobTimezone})`);

   // Telegram attendance reports are user-configured operational notifications.
   // Keep this scheduler alive even if the broader maintenance worker is disabled.
   JobRunner.register(telegramAttendanceSummary);
   JobRunner.register(telegramPersonalBotPoller);
   JobRunner.register(telegramDatabaseBackup);

   if (!env.jobWorkerEnabled) {
      console.log('General background job worker is DISABLED. Telegram attendance scheduler remains active.');
      return;
   }
   console.log('Initializing Background Job Worker...');

   JobRunner.register(approvalDeadlineReminder);
   JobRunner.register(overdueInvoiceReminder);
   JobRunner.register(subscriptionExpiryCheck);
   JobRunner.register(trialExpiryReminder);
   JobRunner.register(scheduledReportRunner);
   JobRunner.register(inactiveUserCleanupCheck);
   JobRunner.register(googleCalendarImportSync);
   JobRunner.register(googleCalendarWatchRenewal);
   JobRunner.register(googleCalendarSyncRetry);
   JobRunner.register(probationCompletionNotifier);
   JobRunner.register(employmentChangeEffectiveDate);

   registerPolicyJobs();
}
