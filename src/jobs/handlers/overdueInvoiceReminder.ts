
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
