import { Op } from "sequelize";
import { db } from "../../models";
import { InternalNotifier } from "../notification/notification.service";
import { GoogleCalendarSyncService } from "./googleCalendarSync.service";
import { CalendarMeeting, CalendarMeetingAttendee } from "./calendarMeeting.models";

const MAX_ATTENDEES = 100;
const VALID_RESPONSE_STATUSES = new Set(["ACCEPTED", "DECLINED"]);

function assertDate(value: unknown, field: string) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) {
    throw Object.assign(new Error(`${field} must be a valid date.`), { statusCode: 400 });
  }
  return date;
}

function uniqueUserIds(value: unknown, organizerUserId: string) {
  const raw = Array.isArray(value) ? value : [];
  const ids = Array.from(
    new Set(
      raw
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .filter((id) => id !== organizerUserId),
    ),
  );

  if (!ids.length) {
    throw Object.assign(new Error("Select at least one attendee."), { statusCode: 400 });
  }
  if (ids.length > MAX_ATTENDEES) {
    throw Object.assign(new Error(`A meeting can include at most ${MAX_ATTENDEES} attendees.`), { statusCode: 400 });
  }
  return ids;
}

function userSummary(user: any) {
  if (!user) return null;
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
  };
}

export class CalendarMeetingService {
  private googleSync = new GoogleCalendarSyncService();

  async list(businessId: string, userId: string, query: any = {}) {
    const attendeeRows = await CalendarMeetingAttendee.findAll({
      where: { businessId, userId },
      attributes: ["meetingId"],
    });
    const attendeeMeetingIds = attendeeRows.map((row: any) => row.meetingId);

    const groupWhere: any = {
      businessId,
      [Op.or]: [
        { organizerUserId: userId },
        ...(attendeeMeetingIds.length ? [{ id: { [Op.in]: attendeeMeetingIds } }] : []),
      ],
    };
    if (query.status) groupWhere.status = String(query.status).toUpperCase();

    const meetings = await CalendarMeeting.findAll({
      where: groupWhere,
      order: [["createdAt", "DESC"]],
      limit: Math.min(Number(query.size || 100), 200),
    });

    const groupRows = await Promise.all(
      meetings.map((meeting: any) => this.serializeMeeting(businessId, meeting, userId)),
    );

    const legacyWhere: any = {
      businessId,
      [Op.or]: [{ requesterUserId: userId }, { recipientUserId: userId }],
    };
    const legacyRequests = await db.UserCalendarMeetingRequest.findAll({
      where: legacyWhere,
      order: [["createdAt", "DESC"]],
      limit: Math.min(Number(query.size || 100), 200),
    });
    const legacyRows = await Promise.all(
      legacyRequests.map((request: any) => this.serializeLegacyMeeting(businessId, request, userId)),
    );

    return [...groupRows, ...legacyRows]
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, Math.min(Number(query.size || 100), 200));
  }

  async create(businessId: string, organizerUserId: string, data: any) {
    const attendeeUserIds = uniqueUserIds(
      data.attendeeUserIds || (data.recipientUserId ? [data.recipientUserId] : []),
      organizerUserId,
    );
    const startAt = assertDate(data.startAt, "startAt");
    const endAt = assertDate(data.endAt, "endAt");
    if (endAt <= startAt) {
      throw Object.assign(new Error("endAt must be after startAt."), { statusCode: 400 });
    }

    const title = String(data.title || "").trim();
    if (!title) throw Object.assign(new Error("Meeting title is required."), { statusCode: 400 });

    const users = await this.loadActiveUsers(businessId, [organizerUserId, ...attendeeUserIds]);
    const organizer = users.get(organizerUserId);
    if (!organizer) throw Object.assign(new Error("Organizer was not found."), { statusCode: 404 });

    const missing = attendeeUserIds.filter((id) => !users.has(id));
    if (missing.length) {
      throw Object.assign(new Error("One or more selected attendees are no longer active."), { statusCode: 404 });
    }

    const conflicts = await this.findConflicts(
      businessId,
      [organizerUserId, ...attendeeUserIds],
      startAt,
      endAt,
    );
    if (conflicts.length) {
      throw Object.assign(new Error("Resolve calendar conflicts before sending the meeting invitations."), {
        statusCode: 409,
        conflicts,
      });
    }

    const transaction = await db.sequelize.transaction();
    let meeting: any;
    try {
      meeting = await CalendarMeeting.create(
        {
          businessId,
          organizerUserId,
          title,
          description: data.description || null,
          location: data.location || null,
          startAt,
          endAt,
          status: "ACTIVE",
          metadata: data.metadata || {},
        },
        { transaction },
      );

      const attendeeSnapshots = attendeeUserIds.map((id) => userSummary(users.get(id)));
      const sharedMetadata = {
        source: "group_meeting",
        groupMeetingId: meeting.id,
        organizer: userSummary(organizer),
        attendees: attendeeSnapshots.map((user) => ({ ...user, status: "PENDING" })),
      };

      const createdOrganizerEvent = await db.UserCalendarEvent.create(
        {
          businessId,
          employeeUserId: organizerUserId,
          organizerUserId,
          itemType: "MEETING",
          title,
          description: data.description || null,
          location: data.location || null,
          startAt,
          endAt,
          availabilityStatus: "UNAVAILABLE",
          color: "#2563eb",
          metadata: { ...sharedMetadata, meetingRole: "ORGANIZER", meetingStatus: "ACTIVE" },
        },
        { transaction },
      );
      await meeting.update({ organizerEventId: createdOrganizerEvent.id }, { transaction });

      for (const attendeeUserId of attendeeUserIds) {
        const attendeeEvent = await db.UserCalendarEvent.create(
          {
            businessId,
            employeeUserId: attendeeUserId,
            organizerUserId,
            itemType: "MEETING",
            title,
            description: data.description || null,
            location: data.location || null,
            startAt,
            endAt,
            availabilityStatus: "UNAVAILABLE",
            color: "#f59e0b",
            metadata: {
              ...sharedMetadata,
              meetingRole: "ATTENDEE",
              attendeeStatus: "PENDING",
              meetingStatus: "ACTIVE",
            },
          },
          { transaction },
        );

        await CalendarMeetingAttendee.create(
          {
            businessId,
            meetingId: meeting.id,
            userId: attendeeUserId,
            status: "PENDING",
            calendarEventId: attendeeEvent.id,
            metadata: {},
          },
          { transaction },
        );
      }

      await transaction.commit();

      const organizerEvent = await db.UserCalendarEvent.findOne({
        where: { id: meeting.organizerEventId, businessId },
      });
      if (organizerEvent) {
        await this.googleSync.syncCreateFromBlih(organizerEvent, { id: organizerUserId, businessId });
      }

      for (const attendeeUserId of attendeeUserIds) {
        const attendee = users.get(attendeeUserId);
        await InternalNotifier.send({
          businessId,
          senderUserId: organizerUserId,
          recipientUserId: attendeeUserId,
          moduleKey: "attendance",
          type: "calendar_group_meeting_request",
          title: "Meeting invitation",
          message: `${organizer.fullName || "A teammate"} invited you to: ${title}.`,
          entityType: "user_calendar_meeting",
          entityId: meeting.id,
          priority: "normal",
        });
      }

      return this.serializeMeeting(businessId, await meeting.reload(), organizerUserId);
    } catch (error) {
      if (!transaction.finished) await transaction.rollback();
      throw error;
    }
  }

  async availability(businessId: string, organizerUserId: string, data: any) {
    const attendeeUserIds = uniqueUserIds(
      data.attendeeUserIds || (data.recipientUserId ? [data.recipientUserId] : []),
      organizerUserId,
    );
    const startAt = assertDate(data.startAt, "startAt");
    const endAt = assertDate(data.endAt, "endAt");
    if (endAt <= startAt) {
      throw Object.assign(new Error("endAt must be after startAt."), { statusCode: 400 });
    }

    const participantIds = [organizerUserId, ...attendeeUserIds];
    const users = await this.loadActiveUsers(businessId, participantIds);
    const ignoredEventIds = data.meetingId
      ? await this.eventIdsForMeeting(businessId, String(data.meetingId))
      : [];
    const conflicts = await this.findConflicts(
      businessId,
      participantIds,
      startAt,
      endAt,
      ignoredEventIds,
    );
    const conflictsByUser = new Map(conflicts.map((row: any) => [row.userId, row]));

    const rows = participantIds.map((id) => ({
      user: userSummary(users.get(id)),
      userId: id,
      role: id === organizerUserId ? "ORGANIZER" : "ATTENDEE",
      available: !conflictsByUser.has(id),
      conflict: conflictsByUser.get(id) || null,
    }));

    return {
      available: rows.every((row) => row.available),
      availableCount: rows.filter((row) => row.available).length,
      conflictCount: rows.filter((row) => !row.available).length,
      attendeeAvailableCount: rows.filter((row) => row.role === "ATTENDEE" && row.available).length,
      attendeeConflictCount: rows.filter((row) => row.role === "ATTENDEE" && !row.available).length,
      rows,
    };
  }

  async commonTimes(businessId: string, organizerUserId: string, data: any) {
    const attendeeUserIds = uniqueUserIds(data.attendeeUserIds, organizerUserId);
    const windows = Array.isArray(data.windows) ? data.windows.slice(0, 14) : [];
    if (!windows.length) {
      throw Object.assign(new Error("Provide at least one search window."), { statusCode: 400 });
    }

    const durationMinutes = Math.min(240, Math.max(15, Number(data.durationMinutes || 30)));
    const stepMinutes = Math.min(60, Math.max(15, Number(data.stepMinutes || 30)));
    const parsedWindows = windows.map((window: any) => {
      const startAt = assertDate(window.startAt, "window.startAt");
      const endAt = assertDate(window.endAt, "window.endAt");
      if (endAt <= startAt) {
        throw Object.assign(new Error("Every common-time window must end after it starts."), { statusCode: 400 });
      }
      return { startAt, endAt };
    });

    const participantIds = [organizerUserId, ...attendeeUserIds];
    const minStart = new Date(Math.min(...parsedWindows.map((window) => window.startAt.getTime())));
    const maxEnd = new Date(Math.max(...parsedWindows.map((window) => window.endAt.getTime())));
    const ignoredEventIds = data.meetingId
      ? await this.eventIdsForMeeting(businessId, String(data.meetingId))
      : [];

    const where: any = {
      businessId,
      employeeUserId: { [Op.in]: participantIds },
      availabilityStatus: "UNAVAILABLE",
      startAt: { [Op.lt]: maxEnd },
      endAt: { [Op.gt]: minStart },
    };
    if (ignoredEventIds.length) where.id = { [Op.notIn]: ignoredEventIds };

    const events = await db.UserCalendarEvent.findAll({
      where,
      attributes: ["id", "employeeUserId", "title", "startAt", "endAt"],
      order: [["startAt", "ASC"]],
    });

    const slots: Array<{ startAt: string; endAt: string }> = [];
    const durationMs = durationMinutes * 60_000;
    const stepMs = stepMinutes * 60_000;

    for (const window of parsedWindows) {
      for (
        let cursor = window.startAt.getTime();
        cursor + durationMs <= window.endAt.getTime();
        cursor += stepMs
      ) {
        const slotStart = new Date(cursor);
        const slotEnd = new Date(cursor + durationMs);
        const conflict = events.some((event: any) => {
          const eventStart = new Date(event.startAt);
          const eventEnd = new Date(event.endAt);
          return slotStart < eventEnd && slotEnd > eventStart;
        });
        if (!conflict) {
          slots.push({ startAt: slotStart.toISOString(), endAt: slotEnd.toISOString() });
          if (slots.length >= 12) return { slots };
        }
      }
    }

    return { slots };
  }

  async respond(businessId: string, userId: string, meetingId: string, data: any) {
    const meeting = await CalendarMeeting.findOne({ where: { id: meetingId, businessId, status: "ACTIVE" } });
    if (!meeting) throw Object.assign(new Error("Meeting not found."), { statusCode: 404 });

    const attendee: any = await CalendarMeetingAttendee.findOne({
      where: { businessId, meetingId, userId },
    });
    if (!attendee) throw Object.assign(new Error("This meeting invitation is not assigned to you."), { statusCode: 403 });
    if (attendee.status !== "PENDING") {
      throw Object.assign(new Error("This meeting invitation has already been handled."), { statusCode: 400 });
    }

    const status = String(data.status || "").toUpperCase();
    if (!VALID_RESPONSE_STATUSES.has(status)) {
      throw Object.assign(new Error("status must be ACCEPTED or DECLINED."), { statusCode: 400 });
    }

    const attendeeEvent = attendee.calendarEventId
      ? await db.UserCalendarEvent.findOne({ where: { id: attendee.calendarEventId, businessId } })
      : null;

    if (status === "ACCEPTED") {
      const ignoredIds = attendeeEvent ? [attendeeEvent.id] : [];
      const conflicts = await this.findConflicts(
        businessId,
        [userId],
        new Date(meeting.startAt),
        new Date(meeting.endAt),
        ignoredIds,
      );
      if (conflicts.length) {
        throw Object.assign(new Error("You already have a calendar conflict at that time."), {
          statusCode: 409,
          conflicts,
        });
      }

      let event = attendeeEvent;
      if (!event) {
        event = await db.UserCalendarEvent.create({
          businessId,
          employeeUserId: userId,
          organizerUserId: meeting.organizerUserId,
          itemType: "MEETING",
          title: meeting.title,
          description: meeting.description,
          location: meeting.location,
          startAt: meeting.startAt,
          endAt: meeting.endAt,
          availabilityStatus: "UNAVAILABLE",
          color: "#2563eb",
          metadata: {
            source: "group_meeting",
            groupMeetingId: meeting.id,
            meetingRole: "ATTENDEE",
            attendeeStatus: "ACCEPTED",
            meetingStatus: "ACTIVE",
          },
        });
        await attendee.update({ calendarEventId: event.id });
      } else {
        await event.update({
          color: "#2563eb",
          metadata: {
            ...(event.metadata || {}),
            attendeeStatus: "ACCEPTED",
            meetingStatus: "ACTIVE",
          },
        });
      }

      await attendee.update({
        status: "ACCEPTED",
        responseNote: data.responseNote || null,
        respondedAt: new Date(),
      });
      await this.refreshEventMetadata(businessId, meeting.id);
      await this.googleSync.syncCreateFromBlih(await event.reload(), { id: userId, businessId });
    } else {
      if (attendeeEvent) {
        if (attendeeEvent.googleEventId) {
          await this.googleSync.syncDeleteFromBlih(attendeeEvent, { id: userId, businessId });
        }
        await attendeeEvent.destroy();
      }
      await attendee.update({
        status: "DECLINED",
        responseNote: data.responseNote || null,
        respondedAt: new Date(),
        calendarEventId: null,
      });
      await this.refreshEventMetadata(businessId, meeting.id);
    }

    const attendeeUser = await db.User.findOne({ where: { id: userId, businessId } });
    await InternalNotifier.send({
      businessId,
      senderUserId: userId,
      recipientUserId: meeting.organizerUserId,
      moduleKey: "attendance",
      type: "calendar_group_meeting_response",
      title: status === "ACCEPTED" ? "Meeting accepted" : "Meeting declined",
      message: `${attendeeUser?.fullName || "A teammate"} ${status === "ACCEPTED" ? "accepted" : "declined"}: ${meeting.title}.`,
      entityType: "user_calendar_meeting",
      entityId: meeting.id,
      priority: "normal",
    });

    return this.serializeMeeting(businessId, await meeting.reload(), userId);
  }

  async update(businessId: string, organizerUserId: string, meetingId: string, data: any) {
    const meeting: any = await CalendarMeeting.findOne({
      where: { id: meetingId, businessId, organizerUserId, status: "ACTIVE" },
    });
    if (!meeting) throw Object.assign(new Error("Meeting not found or you are not the organizer."), { statusCode: 404 });

    const existingAttendees: any[] = await CalendarMeetingAttendee.findAll({
      where: { businessId, meetingId },
    });
    const currentUserIds = existingAttendees
      .filter((attendee) => attendee.status !== "REMOVED")
      .map((attendee) => String(attendee.userId));
    const attendeeUserIds = data.attendeeUserIds
      ? uniqueUserIds(data.attendeeUserIds, organizerUserId)
      : currentUserIds;

    const startAt = data.startAt !== undefined ? assertDate(data.startAt, "startAt") : new Date(meeting.startAt);
    const endAt = data.endAt !== undefined ? assertDate(data.endAt, "endAt") : new Date(meeting.endAt);
    if (endAt <= startAt) {
      throw Object.assign(new Error("endAt must be after startAt."), { statusCode: 400 });
    }

    const title = data.title !== undefined ? String(data.title || "").trim() : meeting.title;
    if (!title) throw Object.assign(new Error("Meeting title is required."), { statusCode: 400 });

    const users = await this.loadActiveUsers(businessId, [organizerUserId, ...attendeeUserIds]);
    if (attendeeUserIds.some((id) => !users.has(id))) {
      throw Object.assign(new Error("One or more selected attendees are no longer active."), { statusCode: 404 });
    }

    const ignoredEventIds = await this.eventIdsForMeeting(businessId, meeting.id);
    const conflicts = await this.findConflicts(
      businessId,
      [organizerUserId, ...attendeeUserIds],
      startAt,
      endAt,
      ignoredEventIds,
    );
    if (conflicts.length) {
      throw Object.assign(new Error("Resolve calendar conflicts before updating this meeting."), {
        statusCode: 409,
        conflicts,
      });
    }

    await meeting.update({
      title,
      description: data.description !== undefined ? data.description || null : meeting.description,
      location: data.location !== undefined ? data.location || null : meeting.location,
      startAt,
      endAt,
      metadata: data.metadata !== undefined ? data.metadata || {} : meeting.metadata || {},
    });

    const existingByUser = new Map(existingAttendees.map((attendee) => [String(attendee.userId), attendee]));
    const desiredSet = new Set(attendeeUserIds);

    for (const attendee of existingAttendees) {
      if (attendee.status === "REMOVED" || desiredSet.has(String(attendee.userId))) continue;
      const event = attendee.calendarEventId
        ? await db.UserCalendarEvent.findOne({ where: { id: attendee.calendarEventId, businessId } })
        : null;
      if (event) {
        if (event.googleEventId) {
          await this.googleSync.syncDeleteFromBlih(event, { id: attendee.userId, businessId });
        }
        await event.destroy();
      }
      await attendee.update({ status: "REMOVED", respondedAt: new Date(), calendarEventId: null });
      await InternalNotifier.send({
        businessId,
        senderUserId: organizerUserId,
        recipientUserId: attendee.userId,
        moduleKey: "attendance",
        type: "calendar_group_meeting_removed",
        title: "Removed from meeting",
        message: `You were removed from: ${meeting.title}.`,
        entityType: "user_calendar_meeting",
        entityId: meeting.id,
        priority: "normal",
      });
    }

    for (const attendeeUserId of attendeeUserIds) {
      const existing: any = existingByUser.get(attendeeUserId);
      if (!existing || existing.status === "REMOVED") {
        const event = await db.UserCalendarEvent.create({
          businessId,
          employeeUserId: attendeeUserId,
          organizerUserId,
          itemType: "MEETING",
          title: meeting.title,
          description: meeting.description,
          location: meeting.location,
          startAt: meeting.startAt,
          endAt: meeting.endAt,
          availabilityStatus: "UNAVAILABLE",
          color: "#f59e0b",
          metadata: {
            source: "group_meeting",
            groupMeetingId: meeting.id,
            meetingRole: "ATTENDEE",
            attendeeStatus: "PENDING",
            meetingStatus: "ACTIVE",
          },
        });

        if (existing) {
          await existing.update({
            status: "PENDING",
            responseNote: null,
            respondedAt: null,
            calendarEventId: event.id,
          });
        } else {
          await CalendarMeetingAttendee.create({
            businessId,
            meetingId: meeting.id,
            userId: attendeeUserId,
            status: "PENDING",
            calendarEventId: event.id,
            metadata: {},
          });
        }

        await InternalNotifier.send({
          businessId,
          senderUserId: organizerUserId,
          recipientUserId: attendeeUserId,
          moduleKey: "attendance",
          type: "calendar_group_meeting_request",
          title: "Meeting invitation",
          message: `You were invited to: ${meeting.title}.`,
          entityType: "user_calendar_meeting",
          entityId: meeting.id,
          priority: "normal",
        });
      }
    }

    const organizerEvent = meeting.organizerEventId
      ? await db.UserCalendarEvent.findOne({ where: { id: meeting.organizerEventId, businessId } })
      : null;
    let organizerCalendarEvent = organizerEvent;
    if (!organizerCalendarEvent) {
      organizerCalendarEvent = await db.UserCalendarEvent.create({
        businessId,
        employeeUserId: organizerUserId,
        organizerUserId,
        itemType: "MEETING",
        title: meeting.title,
        description: meeting.description,
        location: meeting.location,
        startAt: meeting.startAt,
        endAt: meeting.endAt,
        availabilityStatus: "UNAVAILABLE",
        color: "#2563eb",
        metadata: { source: "group_meeting", groupMeetingId: meeting.id, meetingRole: "ORGANIZER", meetingStatus: "ACTIVE" },
      });
      await meeting.update({ organizerEventId: organizerCalendarEvent.id });
    } else {
      await organizerCalendarEvent.update({
        title: meeting.title,
        description: meeting.description,
        location: meeting.location,
        startAt: meeting.startAt,
        endAt: meeting.endAt,
      });
    }

    const remainingAttendees: any[] = await CalendarMeetingAttendee.findAll({
      where: { businessId, meetingId: meeting.id, status: { [Op.ne]: "REMOVED" } },
    });
    for (const attendee of remainingAttendees) {
      if (!attendee.calendarEventId) continue;
      const event = await db.UserCalendarEvent.findOne({ where: { id: attendee.calendarEventId, businessId } });
      if (!event) continue;
      await event.update({
        title: meeting.title,
        description: meeting.description,
        location: meeting.location,
        startAt: meeting.startAt,
        endAt: meeting.endAt,
        color: attendee.status === "ACCEPTED" ? "#2563eb" : "#f59e0b",
      });
      if (attendee.status === "ACCEPTED") {
        await this.googleSync.syncUpdateFromBlih(event, { id: attendee.userId, businessId });
      }
    }

    await this.refreshEventMetadata(businessId, meeting.id);
    await this.googleSync.syncUpdateFromBlih(await organizerCalendarEvent.reload(), { id: organizerUserId, businessId });
    return this.serializeMeeting(businessId, await meeting.reload(), organizerUserId);
  }

  async cancel(businessId: string, organizerUserId: string, meetingId: string) {
    const meeting: any = await CalendarMeeting.findOne({
      where: { id: meetingId, businessId, organizerUserId, status: "ACTIVE" },
    });
    if (!meeting) throw Object.assign(new Error("Meeting not found or you are not the organizer."), { statusCode: 404 });

    const attendees: any[] = await CalendarMeetingAttendee.findAll({ where: { businessId, meetingId } });
    const eventIds = [meeting.organizerEventId, ...attendees.map((attendee) => attendee.calendarEventId)].filter(Boolean);
    const events = eventIds.length
      ? await db.UserCalendarEvent.findAll({ where: { businessId, id: { [Op.in]: eventIds } } })
      : [];

    for (const event of events) {
      if (event.googleEventId) {
        await this.googleSync.syncDeleteFromBlih(event, { id: event.employeeUserId, businessId });
      }
      await event.destroy();
    }

    await meeting.update({ status: "CANCELLED", organizerEventId: null });
    for (const attendee of attendees) {
      await attendee.update({ calendarEventId: null });
      if (attendee.status === "REMOVED") continue;
      await InternalNotifier.send({
        businessId,
        senderUserId: organizerUserId,
        recipientUserId: attendee.userId,
        moduleKey: "attendance",
        type: "calendar_group_meeting_cancelled",
        title: "Meeting cancelled",
        message: `${meeting.title} was cancelled by the organizer.`,
        entityType: "user_calendar_meeting",
        entityId: meeting.id,
        priority: "normal",
      });
    }

    return this.serializeMeeting(businessId, await meeting.reload(), organizerUserId);
  }

  async eventDetails(businessId: string, eventId: string, currentUserId: string) {
    const event = await db.UserCalendarEvent.findOne({ where: { id: eventId, businessId } });
    if (!event) throw Object.assign(new Error("Calendar event not found."), { statusCode: 404 });

    const groupMeetingId = String(event.metadata?.groupMeetingId || "");
    if (groupMeetingId) {
      const meeting = await CalendarMeeting.findOne({ where: { id: groupMeetingId, businessId } });
      if (meeting) return this.serializeMeeting(businessId, meeting, currentUserId);
    }

    if (event.meetingRequestId) {
      const legacy = await db.UserCalendarMeetingRequest.findOne({
        where: { id: event.meetingRequestId, businessId },
      });
      if (legacy) return this.serializeLegacyMeeting(businessId, legacy, currentUserId);
    }

    const organizer = event.organizerUserId
      ? await db.User.findOne({ where: { id: event.organizerUserId, businessId } })
      : null;
    return {
      id: null,
      legacy: false,
      meetingStatus: null,
      organizerUserId: event.organizerUserId || event.employeeUserId,
      requesterUserId: event.organizerUserId || event.employeeUserId,
      organizer: userSummary(organizer),
      requester: userSummary(organizer),
      attendees: [],
      currentUserStatus: null,
      title: event.title,
      description: event.description,
      location: event.location,
      startAt: event.startAt,
      endAt: event.endAt,
    };
  }

  private async serializeMeeting(businessId: string, meeting: any, currentUserId?: string) {
    const attendees: any[] = await CalendarMeetingAttendee.findAll({
      where: { businessId, meetingId: meeting.id, status: { [Op.ne]: "REMOVED" } },
      order: [["createdAt", "ASC"]],
    });
    const users = await this.loadUsers(businessId, [meeting.organizerUserId, ...attendees.map((attendee) => attendee.userId)]);
    const organizer = userSummary(users.get(String(meeting.organizerUserId)));
    const serializedAttendees = attendees.map((attendee) => ({
      id: attendee.id,
      userId: attendee.userId,
      status: attendee.status,
      responseNote: attendee.responseNote,
      respondedAt: attendee.respondedAt,
      calendarEventId: attendee.calendarEventId,
      user: userSummary(users.get(String(attendee.userId))),
    }));
    const currentAttendee = currentUserId
      ? serializedAttendees.find((attendee) => attendee.userId === currentUserId)
      : undefined;
    const singleRecipient = serializedAttendees.length === 1 ? serializedAttendees[0] : undefined;

    return {
      id: meeting.id,
      legacy: false,
      isGroup: serializedAttendees.length > 1,
      businessId,
      organizerUserId: meeting.organizerUserId,
      requesterUserId: meeting.organizerUserId,
      requester: organizer,
      organizer,
      recipientUserId: singleRecipient?.userId || null,
      recipient: singleRecipient?.user || null,
      title: meeting.title,
      description: meeting.description,
      location: meeting.location,
      startAt: meeting.startAt,
      endAt: meeting.endAt,
      meetingStatus: meeting.status,
      status: currentAttendee?.status || meeting.status,
      currentUserStatus: currentAttendee?.status || null,
      attendees: serializedAttendees,
      pendingAttendeeCount: serializedAttendees.filter((attendee) => attendee.status === "PENDING").length,
      acceptedAttendeeCount: serializedAttendees.filter((attendee) => attendee.status === "ACCEPTED").length,
      declinedAttendeeCount: serializedAttendees.filter((attendee) => attendee.status === "DECLINED").length,
      createdAt: meeting.createdAt,
      updatedAt: meeting.updatedAt,
    };
  }

  private async serializeLegacyMeeting(businessId: string, request: any, currentUserId?: string) {
    const users = await this.loadUsers(businessId, [request.requesterUserId, request.recipientUserId]);
    const requester = userSummary(users.get(String(request.requesterUserId)));
    const recipient = userSummary(users.get(String(request.recipientUserId)));
    const attendee = {
      id: `legacy:${request.id}:${request.recipientUserId}`,
      userId: request.recipientUserId,
      status: request.status,
      responseNote: request.responseNote,
      respondedAt: request.respondedAt,
      calendarEventId: request.recipientEventId,
      user: recipient,
    };

    return {
      id: request.id,
      legacy: true,
      isGroup: false,
      businessId,
      organizerUserId: request.requesterUserId,
      requesterUserId: request.requesterUserId,
      requester,
      organizer: requester,
      recipientUserId: request.recipientUserId,
      recipient,
      title: request.title,
      description: request.description,
      location: request.location,
      startAt: request.startAt,
      endAt: request.endAt,
      meetingStatus: request.status,
      status: request.status,
      currentUserStatus: currentUserId === request.recipientUserId ? request.status : null,
      attendees: [attendee],
      pendingAttendeeCount: request.status === "PENDING" ? 1 : 0,
      acceptedAttendeeCount: request.status === "ACCEPTED" ? 1 : 0,
      declinedAttendeeCount: request.status === "DECLINED" ? 1 : 0,
      responseNote: request.responseNote,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    };
  }

  private async refreshEventMetadata(businessId: string, meetingId: string) {
    const meeting: any = await CalendarMeeting.findOne({ where: { id: meetingId, businessId } });
    if (!meeting) return;
    const serialized: any = await this.serializeMeeting(businessId, meeting);
    const shared = {
      source: "group_meeting",
      groupMeetingId: meeting.id,
      meetingStatus: meeting.status,
      organizer: serialized.organizer,
      attendees: serialized.attendees.map((attendee: any) => ({
        id: attendee.userId,
        fullName: attendee.user?.fullName,
        email: attendee.user?.email,
        status: attendee.status,
      })),
    };

    if (meeting.organizerEventId) {
      const organizerEvent = await db.UserCalendarEvent.findOne({ where: { id: meeting.organizerEventId, businessId } });
      if (organizerEvent) {
        await organizerEvent.update({
          metadata: { ...(organizerEvent.metadata || {}), ...shared, meetingRole: "ORGANIZER" },
        });
      }
    }

    for (const attendee of serialized.attendees) {
      if (!attendee.calendarEventId) continue;
      const event = await db.UserCalendarEvent.findOne({ where: { id: attendee.calendarEventId, businessId } });
      if (!event) continue;
      await event.update({
        metadata: {
          ...(event.metadata || {}),
          ...shared,
          meetingRole: "ATTENDEE",
          attendeeStatus: attendee.status,
        },
      });
    }
  }

  private async eventIdsForMeeting(businessId: string, meetingId: string) {
    const meeting: any = await CalendarMeeting.findOne({ where: { id: meetingId, businessId } });
    if (!meeting) return [];
    const attendees: any[] = await CalendarMeetingAttendee.findAll({
      where: { businessId, meetingId },
      attributes: ["calendarEventId"],
    });
    return [meeting.organizerEventId, ...attendees.map((attendee) => attendee.calendarEventId)]
      .filter(Boolean)
      .map(String);
  }

  private async findConflicts(
    businessId: string,
    userIds: string[],
    startAt: Date,
    endAt: Date,
    ignoredEventIds: string[] = [],
  ) {
    const where: any = {
      businessId,
      employeeUserId: { [Op.in]: userIds },
      availabilityStatus: "UNAVAILABLE",
      startAt: { [Op.lt]: endAt },
      endAt: { [Op.gt]: startAt },
    };
    if (ignoredEventIds.length) where.id = { [Op.notIn]: ignoredEventIds };

    const events = await db.UserCalendarEvent.findAll({
      where,
      attributes: ["id", "employeeUserId", "title", "startAt", "endAt", "itemType"],
      order: [["startAt", "ASC"]],
    });

    const firstByUser = new Map<string, any>();
    for (const event of events) {
      const id = String(event.employeeUserId);
      if (!firstByUser.has(id)) {
        firstByUser.set(id, {
          userId: id,
          eventId: event.id,
          title: event.title,
          itemType: event.itemType,
          startAt: event.startAt,
          endAt: event.endAt,
        });
      }
    }
    return Array.from(firstByUser.values());
  }

  private async loadActiveUsers(businessId: string, userIds: string[]) {
    const users = await db.User.findAll({
      where: { businessId, id: { [Op.in]: userIds }, status: "active" },
      attributes: ["id", "fullName", "email"],
    });
    return new Map(users.map((user: any) => [String(user.id), user]));
  }

  private async loadUsers(businessId: string, userIds: string[]) {
    const ids = Array.from(new Set(userIds.filter(Boolean).map(String)));
    if (!ids.length) return new Map<string, any>();
    const users = await db.User.findAll({
      where: { businessId, id: { [Op.in]: ids } },
      attributes: ["id", "fullName", "email"],
    });
    return new Map(users.map((user: any) => [String(user.id), user]));
  }
}
