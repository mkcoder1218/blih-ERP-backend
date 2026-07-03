import { Op } from "sequelize";
import { db } from "../../models";
import { GoogleCalendarSyncService } from "../../modules/calendar/googleCalendarSync.service";
import { JobDefinition } from "../runner";

const googleSync = new GoogleCalendarSyncService();

export const googleCalendarImportSync: JobDefinition = {
  name: "GoogleCalendarImportSync",
  type: "calendar",
  cronExpression: "*/30 * * * *",
  handler: async () => {
    const settings = await db.BusinessSetting.findAll({
      where: {
        key: { [Op.like]: "google_calendar:%" },
      },
      limit: 500,
    });

    for (const setting of settings) {
      const userId = String(setting.key || "").replace("google_calendar:", "");
      if (!setting.businessId || !userId) continue;
      try {
        const result = await googleSync.syncFromGoogle({ businessId: setting.businessId, id: userId });
        console.log(
          `[GoogleCalendarImportSync] ${setting.businessId}/${userId}: imported=${result.importedCount}, updated=${result.updatedCount}, deleted=${result.deletedCount}, skipped=${result.skippedCount}, failed=${result.failedCount}`
        );
      } catch (err: any) {
        console.error(`[GoogleCalendarImportSync] ${setting.businessId}/${userId} failed:`, err?.message || err);
      }
    }
  },
};
