import { Op } from "sequelize";
import { db } from "../../models";
import { GoogleCalendarSyncService } from "../../modules/calendar/googleCalendarSync.service";
import { JobDefinition } from "../runner";

const googleSync = new GoogleCalendarSyncService();
const RENEW_WITHIN_MS = 24 * 60 * 60 * 1000;

function userIdFromKey(key: string) {
  return key.startsWith("google_calendar:") ? key.slice("google_calendar:".length) : "";
}

export const googleCalendarWatchRenewal: JobDefinition = {
  name: "GoogleCalendarWatchRenewal",
  type: "calendar",
  cronExpression: "0 */6 * * *",
  handler: async () => {
    const settings = await db.BusinessSetting.findAll({
      where: {
        key: { [Op.like]: "google_calendar:%" },
      },
      limit: 500,
    });

    for (const setting of settings) {
      const userId = userIdFromKey(String(setting.key || ""));
      if (!userId) continue;
      const value = setting.value || {};
      const expiresAt = value.watchExpiresAt ? new Date(value.watchExpiresAt).getTime() : 0;
      const shouldRenew = !expiresAt || expiresAt - Date.now() <= RENEW_WITHIN_MS || value.watchStatus === "WATCH_FAILED";
      if (!shouldRenew) continue;

      try {
        await googleSync.renewCalendarWatch(userId, setting.businessId);
        console.log(`[GoogleCalendarWatchRenewal] renewed ${setting.businessId}/${userId}`);
      } catch (err: any) {
        await db.CalendarSyncRetryJob.findOrCreate({
          where: {
            businessId: setting.businessId,
            userId,
            actionType: "RENEW_GOOGLE_WATCH",
            status: "PENDING",
          },
          defaults: {
            businessId: setting.businessId,
            userId,
            actionType: "RENEW_GOOGLE_WATCH",
            payload: {},
            status: "PENDING",
            nextRunAt: new Date(Date.now() + 10 * 60_000),
            lastError: String(err?.message || "Google Calendar watch renewal failed").slice(0, 4000),
          },
        });
        await setting.update({
          value: {
            ...(setting.value || {}),
            watchStatus: err?.googleStatus === 401 || err?.googleStatus === 403 ? "NEEDS_RECONNECT" : "WATCH_FAILED",
            watchError: String(err?.message || "Google Calendar watch renewal failed").slice(0, 1000),
            watchUpdatedAt: new Date().toISOString(),
          },
        });
        console.error(`[GoogleCalendarWatchRenewal] ${setting.businessId}/${userId} failed:`, err?.message || err);
      }
    }
  },
};
