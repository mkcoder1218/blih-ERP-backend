import { db } from "../../models";
import { GoogleCalendarSyncService } from "./googleCalendarSync.service";

function isPendingGroupAttendeeEvent(event: any) {
  const metadata = event?.metadata || {};
  return (
    metadata.source === "group_meeting" &&
    metadata.meetingRole === "ATTENDEE" &&
    metadata.attendeeStatus !== "ACCEPTED"
  );
}

export class CalendarGooglePolicyService {
  private googleSync = new GoogleCalendarSyncService();

  async syncEvent(businessId: string, userId: string, eventId: string) {
    if (eventId.startsWith("project-task:")) {
      throw Object.assign(new Error("Open the task in Project Management to sync it."), { statusCode: 400 });
    }

    const event = await db.UserCalendarEvent.findOne({
      where: { id: eventId, businessId, employeeUserId: userId },
    });
    if (!event) {
      throw Object.assign(new Error("Calendar event not found."), { statusCode: 404 });
    }
    if (isPendingGroupAttendeeEvent(event)) {
      throw Object.assign(
        new Error("Accept this meeting invitation before syncing it to Google Calendar."),
        { statusCode: 400 },
      );
    }

    return this.googleSync.syncUpdateFromBlih(event, { id: userId, businessId });
  }

  async syncAll(businessId: string, userId: string) {
    const events = await db.UserCalendarEvent.findAll({
      where: { businessId, employeeUserId: userId },
      order: [["startAt", "ASC"]],
    });

    const synced: any[] = [];
    const failed: Array<{ id: string; title: string; message: string }> = [];
    let skippedCount = 0;

    for (const event of events) {
      if (isPendingGroupAttendeeEvent(event)) {
        skippedCount += 1;
        continue;
      }

      try {
        const result = await this.googleSync.syncUpdateFromBlih(event, { id: userId, businessId });
        if (result.googleSyncStatus === "SYNCED") {
          synced.push(result);
        } else {
          failed.push({
            id: event.id,
            title: event.title,
            message: result.googleSyncError || result.googleSyncStatus,
          });
        }
      } catch (err: any) {
        failed.push({
          id: event.id,
          title: event.title,
          message: err?.message || "Sync failed",
        });
      }
    }

    return {
      syncedCount: synced.length,
      failedCount: failed.length,
      skippedCount,
      failed,
    };
  }
}
