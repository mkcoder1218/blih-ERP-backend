import { Op } from "sequelize";
import { db } from "../../models";
import { GoogleCalendarSyncService } from "../../modules/calendar/googleCalendarSync.service";
import { JobDefinition } from "../runner";

const googleSync = new GoogleCalendarSyncService();

export const googleCalendarSyncRetry: JobDefinition = {
  name: "GoogleCalendarSyncRetry",
  type: "calendar",
  cronExpression: "*/5 * * * *",
  handler: async () => {
    const jobs = await db.CalendarSyncRetryJob.findAll({
      where: {
        status: { [Op.in]: ["PENDING", "FAILED"] },
        nextRunAt: { [Op.lte]: new Date() },
      },
      order: [["nextRunAt", "ASC"]],
      limit: 25,
    });

    for (const job of jobs) {
      await googleSync.retrySyncJob(job);
    }
  },
};
