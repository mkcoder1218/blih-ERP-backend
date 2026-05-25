
import { JobDefinition } from '../runner';
import { db } from '../../models';

export const approvalDeadlineReminder: JobDefinition = {
  name: 'ApprovalDeadlineReminder',
  type: 'notification',
  cronExpression: '0 8 * * *', // Daily at 8 AM
  handler: async () => {
     // Mock logic to scan pending approvals crossing deadline
     // In an actual scenario this limits search to active businessIds and un-suspended
     const pendingApprovals = await db.ApprovalRequest.findAll({
        where: { status: 'pending' },
        include: [{ model: db.Business }] // requires checking business active sub ideally
     });
     // Iterate and push notification triggers mock
  }
};
