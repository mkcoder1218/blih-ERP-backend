
import { JobDefinition } from '../runner';
import { db } from '../../models';

export const scheduledReportRunner: JobDefinition = {
  name: 'ScheduledReportRunner',
  type: 'report',
  cronExpression: '0 * * * *', // Hourly sweep
  handler: async () => {
      // Find ReportDefinitions with schedule configurations that match current hour
  }
};
