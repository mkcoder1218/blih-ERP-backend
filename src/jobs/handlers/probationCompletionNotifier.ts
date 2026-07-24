import type { JobDefinition } from "../runner";
import { ProbationReminderService } from "../../modules/hr/probation.reminder.service";

const service = new ProbationReminderService();

export const probationCompletionNotifier: JobDefinition = {
  name: "probation-lifecycle-reminders",
  type: "hr",
  cronExpression: "0 8 * * *",
  handler: async () => {
    const result = await service.run();
    console.log(`[ProbationLifecycleReminders] scanned=${result.scanned} notifications=${result.notificationsSent} emails=${result.emailsSent}`);
  },
};
