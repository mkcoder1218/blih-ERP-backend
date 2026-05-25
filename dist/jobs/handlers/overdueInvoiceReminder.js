"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.overdueInvoiceReminder = void 0;
exports.overdueInvoiceReminder = {
    name: 'OverdueInvoiceReminder',
    type: 'billing',
    cronExpression: '0 8 * * *',
    handler: async () => {
        // Mock scan subscription or finance invoices
    }
};
