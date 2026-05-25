
import { JobDefinition } from '../runner';
import { db } from '../../models';
import { Op } from 'sequelize';

export const subscriptionExpiryCheck: JobDefinition = {
  name: 'SubscriptionExpiryCheck',
  type: 'billing',
  cronExpression: '0 0 * * *', // Midnight
  handler: async () => {
     const now = new Date();
     await db.Subscription.update(
        { status: 'expired' },
        { where: { endDate: { [Op.lt]: now }, status: 'active' } }
     );
  }
};
