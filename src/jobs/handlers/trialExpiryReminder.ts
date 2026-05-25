
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
