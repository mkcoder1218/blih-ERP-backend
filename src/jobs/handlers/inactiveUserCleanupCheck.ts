
import { JobDefinition } from '../runner';
import { db } from '../../models';

export const inactiveUserCleanupCheck: JobDefinition = {
  name: 'InactiveUserCleanupCheck',
  type: 'maintenance',
  cronExpression: '0 2 * * 0', // Weekly sunday 2am
  handler: async () => {
     // Disable users inactive > 90 days
  }
};
