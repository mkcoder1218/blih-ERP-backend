"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initJobs = initJobs;
const runner_1 = require("./runner");
const env_1 = require("../config/env");
const approvalDeadlineReminder_1 = require("./handlers/approvalDeadlineReminder");
const overdueInvoiceReminder_1 = require("./handlers/overdueInvoiceReminder");
const subscriptionExpiryCheck_1 = require("./handlers/subscriptionExpiryCheck");
const trialExpiryReminder_1 = require("./handlers/trialExpiryReminder");
const scheduledReportRunner_1 = require("./handlers/scheduledReportRunner");
const inactiveUserCleanupCheck_1 = require("./handlers/inactiveUserCleanupCheck");
const telegramAttendanceSummary_1 = require("./handlers/telegramAttendanceSummary");
const telegramPersonalBotPoller_1 = require("./handlers/telegramPersonalBotPoller");
function initJobs() {
    console.log(`Background job worker flag: ${env_1.env.jobWorkerEnabled ? 'ENABLED' : 'DISABLED'} (timezone: ${env_1.env.jobTimezone})`);
    // Telegram attendance reports are user-configured operational notifications.
    // Keep this scheduler alive even if the broader maintenance worker is disabled.
    runner_1.JobRunner.register(telegramAttendanceSummary_1.telegramAttendanceSummary);
    runner_1.JobRunner.register(telegramPersonalBotPoller_1.telegramPersonalBotPoller);
    if (!env_1.env.jobWorkerEnabled) {
        console.log('General background job worker is DISABLED. Telegram attendance scheduler remains active.');
        return;
    }
    console.log('Initializing Background Job Worker...');
    runner_1.JobRunner.register(approvalDeadlineReminder_1.approvalDeadlineReminder);
    runner_1.JobRunner.register(overdueInvoiceReminder_1.overdueInvoiceReminder);
    runner_1.JobRunner.register(subscriptionExpiryCheck_1.subscriptionExpiryCheck);
    runner_1.JobRunner.register(trialExpiryReminder_1.trialExpiryReminder);
    runner_1.JobRunner.register(scheduledReportRunner_1.scheduledReportRunner);
    runner_1.JobRunner.register(inactiveUserCleanupCheck_1.inactiveUserCleanupCheck);
}
