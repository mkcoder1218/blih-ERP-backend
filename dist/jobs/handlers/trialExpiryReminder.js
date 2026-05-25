"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trialExpiryReminder = void 0;
exports.trialExpiryReminder = {
    name: 'TrialExpiryReminder',
    type: 'billing',
    cronExpression: '0 9 * * *',
    handler: async () => {
        // Send notifications to trials expiring in < 3 days
    }
};
