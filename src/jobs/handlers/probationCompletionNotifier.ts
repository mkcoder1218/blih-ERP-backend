import type { JobDefinition } from '../runner';
import { HRPerformanceService } from '../../modules/hr/performance.service';

const service = new HRPerformanceService();

export const probationCompletionNotifier: JobDefinition = {
  name: 'probation-completion-notifier',
  type: 'hr',
  cronExpression: '0 8 * * *',
  handler: async () => {
    const result = await service.processProbationCompletionNotifications();
    console.log(`[ProbationCompletionNotifier] scanned=${result.scanned} emailsSent=${result.emailsSent}`);
  }
};
