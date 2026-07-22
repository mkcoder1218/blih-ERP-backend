import { Op } from "sequelize";
import { db } from "../../models";
import { InternalNotifier } from "../notification/notification.service";
import { GoogleCalendarSyncService } from "./googleCalendarSync.service";

const VALID_AVAILABILITY = new Set(["AVAILABLE", "UNAVAILABLE"]);
const VALID_ITEM_TYPES = new Set(["TASK", "EVENT", "AVAILABILITY", "MEETING"]);
const VALID_MEETING_STATUS = new Set(["PENDING", "ACCEPTED", "DECLINED"]);
import { normalizeRecurrenceRule } from "./calendarRecurrence";
function assertAvailability(value: string) {
  if (!VALID_AVAILABILITY.has(value)) throw Object.assign(new Error("Invalid availability status."), { statusCode: 400 });
}

function assertItemType(value: string) {
  if (!VALID_ITEM_TYPES.has(value)) throw Object.assign(new Error("Invalid calendar item type."), { statusCode: 400 });
}

function assertDate(value: unknown, field: string) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) throw Object.assign(new Error(`${field} must be a valid date.`), { statusCode: 400 });
  return date;
}

function ymd(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}

function endOfDate(value: Date | string) {
  const date = new Date(`${ymd(value)}T23:59:59.999Z`);
  return date;
}

export class CalendarService {
  private googleSync = new GoogleCalendarSyncService();

  async list(businessId: string, userId: string, query: any = {}) {
    const rows = await this.listCalendarEvents(businessId, String(query.userId || userId), query);
    if (!query.userId || String(query.userId) === userId) {
      const taskRows = await this.listProjectTaskCalendarRows(businessId, userId, query);
      return [...rows, ...taskRows].sort((a: any, b: any) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    }
    return rows;
  }

  async listPeople(businessId: string, query: any = {}) {
    const search = String(query.search || "").trim();
    const where: any = { businessId, status: "active" };
    if (search) {
      where[Op.or] = [
        { fullName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }
    const users = await db.User.findAll({
      where,
      attributes: ["id", "fullName", "email", "phone", "status"],
      order: [["fullName", "ASC"]],
      limit: Math.min(Number(query.size || 100), 200),
    });
    const statuses = await Promise.all(users.map(async (user: any) => ({ user, status: await this.status(businessId, user.id) })));
    return statuses.map(({ user, status }) => ({
      ...user.toJSON(),
      availabilityStatus: status.availabilityStatus,
      unavailableUntil: status.event?.endAt || null,
      currentBlock: status.event || null,
    }));
  }

  async create(businessId: string, userId: string, data: any) {
    const startAt = assertDate(data.startAt, "startAt");
    const endAt = assertDate(data.endAt, "endAt");
    if (endAt <= startAt) throw Object.assign(new Error("endAt must be after startAt."), { statusCode: 400 });
    const itemType = String(data.itemType || "EVENT").toUpperCase();
    assertItemType(itemType);
    const recurrenceRule =
      itemType === "TASK" ||
      itemType === "AVAILABILITY" ||
      itemType === "MEETING"
        ? null
        : normalizeRecurrenceRule(
            data.recurrenceRule,
          );
    const availabilityStatus = String(data.availabilityStatus || (itemType === "AVAILABILITY" ? "UNAVAILABLE" : "AVAILABLE")).toUpperCase();
    assertAvailability(availabilityStatus);
    const title = String(data.title || (itemType === "AVAILABILITY" ? availabilityStatus : "")).trim();
    if (!title) throw Object.assign(new Error("title is required."), { statusCode: 400 });

    const event = await db.UserCalendarEvent.create({
      businessId,
      employeeUserId: userId,
      organizerUserId: userId,
      itemType,
      title,
      description: data.description || null,
      location: data.location || null,
      startAt,
      endAt,
      recurrenceRule,
      isRecurring: Boolean(recurrenceRule),
      isRecurringInstance: false,
      allDay: Boolean(data.allDay),
      availabilityStatus,
      color: data.color || null,
      projectId: data.projectId || null,
      metadata: data.metadata || {},
    });

    if (itemType === "TASK") {
      const task = await this.createProjectTaskForCalendarEvent(businessId, userId, event, data.projectId || null);
      await event.update({ projectId: task.projectId, projectTaskId: task.id, metadata: { ...(event.metadata || {}), projectTaskLinked: true } });
    }

    const reloaded = await event.reload();
    return this.googleSync.syncCreateFromBlih(reloaded, { id: userId, businessId });
  }

  async update(businessId: string, userId: string, eventId: string, data: any) {

    if (eventId.startsWith("project-task:")) {
      return this.updateProjectTaskCalendarRow(businessId, userId, eventId.replace("project-task:", ""), data);
    }
    const event = await db.UserCalendarEvent.findOne({ where: { id: eventId, businessId, employeeUserId: userId } });
    if (!event) throw Object.assign(new Error("Calendar event not found."), { statusCode: 404 });
    const payload: any = {};
    if (data.title !== undefined) {
      if (!String(data.title || "").trim()) throw Object.assign(new Error("title is required."), { statusCode: 400 });
      payload.title = String(data.title).trim();
    }
    if (data.description !== undefined) payload.description = data.description || null;
    if (data.location !== undefined) payload.location = data.location || null;
    if (data.startAt !== undefined) payload.startAt = assertDate(data.startAt, "startAt");
    if (data.endAt !== undefined) payload.endAt = assertDate(data.endAt, "endAt");
    const nextStart = payload.startAt || new Date(event.startAt);
    const nextEnd = payload.endAt || new Date(event.endAt);
    if (nextEnd <= nextStart) throw Object.assign(new Error("endAt must be after startAt."), { statusCode: 400 });
    if (data.allDay !== undefined) payload.allDay = Boolean(data.allDay);
    if (data.itemType !== undefined) {
      payload.itemType = String(data.itemType).toUpperCase();
      assertItemType(payload.itemType);
    }
    if (data.availabilityStatus !== undefined) {
      payload.availabilityStatus = String(data.availabilityStatus).toUpperCase();
      assertAvailability(payload.availabilityStatus);
    }
    if (data.color !== undefined) payload.color = data.color || null;
    if (data.projectId !== undefined) payload.projectId = data.projectId || null;
    if (data.metadata !== undefined) payload.metadata = data.metadata || {};
    if (data.recurrenceRule !== undefined) {
      const nextItemType =
        payload.itemType || event.itemType;

      const recurrenceRule =
        nextItemType === "TASK" ||
        nextItemType === "AVAILABILITY" ||
        nextItemType === "MEETING"
          ? null
          : normalizeRecurrenceRule(
              data.recurrenceRule,
            );

      payload.recurrenceRule = recurrenceRule;
      payload.isRecurring = Boolean(recurrenceRule);
      payload.isRecurringInstance = false;
    }

    if (
      payload.itemType === "TASK" ||
      payload.itemType === "AVAILABILITY" ||
      payload.itemType === "MEETING"
    ) {
      payload.recurrenceRule = null;
      payload.isRecurring = false;
      payload.isRecurringInstance = false;
    }
    if (Object.keys(payload).length) await event.update(payload);

    if ((event.itemType === "TASK" || payload.itemType === "TASK") && event.projectTaskId) {
      await this.syncProjectTaskFromCalendarEvent(businessId, userId, await event.reload());
    }
    const reloaded = await event.reload();
    return this.googleSync.syncUpdateFromBlih(reloaded, { id: userId, businessId });
  }

  async remove(businessId: string, userId: string, eventId: string) {
    if (eventId.startsWith("project-task:")) throw Object.assign(new Error("Project tasks must be deleted from Project Management."), { statusCode: 400 });
    const event = await db.UserCalendarEvent.findOne({ where: { id: eventId, businessId, employeeUserId: userId } });
    if (!event) throw Object.assign(new Error("Calendar event not found."), { statusCode: 404 });
    await event.update({ deletedSource: "BLIH" });
    await event.destroy();
    await this.googleSync.syncDeleteFromBlih(event, { id: userId, businessId });
  }

  async status(businessId: string, userId: string, at = new Date()) {
    const current = await db.UserCalendarEvent.findOne({
      where: {
        businessId,
        employeeUserId: userId,
        availabilityStatus: "UNAVAILABLE",
        startAt: { [Op.lte]: at },
        endAt: { [Op.gt]: at },
      },
      order: [["endAt", "ASC"]],
    });
    return { availabilityStatus: current ? "UNAVAILABLE" : "AVAILABLE", event: current };
  }

  async createMeetingRequest(businessId: string, requesterUserId: string, data: any) {
    const recipientUserId = String(data.recipientUserId || "");
    if (!recipientUserId || recipientUserId === requesterUserId) throw Object.assign(new Error("Choose another employee to meet."), { statusCode: 400 });
    const recipient = await db.User.findOne({ where: { id: recipientUserId, businessId, status: "active" } });
    if (!recipient) throw Object.assign(new Error("Employee not found."), { statusCode: 404 });
    const requester = await db.User.findOne({ where: { id: requesterUserId, businessId } });
    const startAt = assertDate(data.startAt, "startAt");
    const endAt = assertDate(data.endAt, "endAt");
    if (endAt <= startAt) throw Object.assign(new Error("endAt must be after startAt."), { statusCode: 400 });
    if (await this.hasMeetingConflict(businessId, recipientUserId, startAt, endAt)) {
      throw Object.assign(new Error(`${recipient.fullName} already has a meeting at that time.`), { statusCode: 409 });
    }
    const title = String(data.title || `Meeting with ${requester?.fullName || "employee"}`).trim();
    const request = await db.UserCalendarMeetingRequest.create({
      businessId,
      requesterUserId,
      recipientUserId,
      title,
      description: data.description || null,
      location: data.location || null,
      startAt,
      endAt,
      status: "PENDING",
      metadata: data.metadata || {},
    });
    const pendingMetadata = { meetingStatus: "PENDING", approved: false, source: "meeting_request" };
    const requesterEvent = await db.UserCalendarEvent.create({
      businessId,
      employeeUserId: requesterUserId,
      organizerUserId: requesterUserId,
      meetingRequestId: request.id,
      itemType: "MEETING",
      title,
      description: data.description || null,
      location: data.location || null,
      startAt,
      endAt,
      availabilityStatus: "UNAVAILABLE",
      color: "#f59e0b",
      metadata: { ...pendingMetadata, attendeeUserId: recipientUserId },
    });
    const recipientEvent = await db.UserCalendarEvent.create({
      businessId,
      employeeUserId: recipientUserId,
      organizerUserId: requesterUserId,
      meetingRequestId: request.id,
      itemType: "MEETING",
      title,
      description: data.description || null,
      location: data.location || null,
      startAt,
      endAt,
      availabilityStatus: "UNAVAILABLE",
      color: "#f59e0b",
      metadata: { ...pendingMetadata, attendeeUserId: requesterUserId },
    });
    await this.googleSync.syncCreateFromBlih(requesterEvent, { id: requesterUserId, businessId });
    await this.googleSync.syncCreateFromBlih(recipientEvent, { id: recipientUserId, businessId });
    await request.update({ requesterEventId: requesterEvent.id, recipientEventId: recipientEvent.id });
    await InternalNotifier.send({
      businessId,
      senderUserId: requesterUserId,
      recipientUserId,
      moduleKey: "attendance",
      type: "calendar_meeting_request",
      title: "Meeting request",
      message: `${requester?.fullName || "A teammate"} requested a meeting: ${title}.`,
      entityType: "user_calendar_meeting_request",
      entityId: request.id,
      priority: "normal",
    });
    return request;
  }

  async listMeetingRequests(businessId: string, userId: string, query: any = {}) {
    const status = String(query.status || "").toUpperCase();
    const where: any = {
      businessId,
      [Op.or]: [{ requesterUserId: userId }, { recipientUserId: userId }],
    };
    if (status && VALID_MEETING_STATUS.has(status)) where.status = status;
    return db.UserCalendarMeetingRequest.findAll({
      where,
      include: [
        { model: db.User, as: "requester", attributes: ["id", "fullName", "email"] },
        { model: db.User, as: "recipient", attributes: ["id", "fullName", "email"] },
      ],
      order: [["createdAt", "DESC"]],
      limit: Math.min(Number(query.size || 50), 100),
    });
  }

  async respondMeetingRequest(businessId: string, userId: string, requestId: string, data: any) {
    const request = await db.UserCalendarMeetingRequest.findOne({ where: { id: requestId, businessId, recipientUserId: userId } });
    if (!request) throw Object.assign(new Error("Meeting request not found."), { statusCode: 404 });
    if (request.status !== "PENDING") throw Object.assign(new Error("Meeting request has already been handled."), { statusCode: 400 });
    const status = String(data.status || "").toUpperCase();
    if (!["ACCEPTED", "DECLINED"].includes(status)) throw Object.assign(new Error("status must be ACCEPTED or DECLINED."), { statusCode: 400 });

    if (status === "DECLINED") {
      await request.update({ status, responseNote: data.responseNote || null, respondedAt: new Date() });
      const events = await db.UserCalendarEvent.findAll({ where: { businessId, meetingRequestId: request.id } });
      await db.UserCalendarEvent.destroy({ where: { businessId, meetingRequestId: request.id } });
      for (const event of events) {
        await this.googleSync.syncDeleteFromBlih(event, { id: event.employeeUserId, businessId });
      }
      await this.notifyMeetingResponse(businessId, request, false);
      return request.reload({ include: this.meetingIncludes() });
    }

    if (await this.hasMeetingConflict(businessId, request.recipientUserId, request.startAt, request.endAt, request.id)) {
      throw Object.assign(new Error("You already have a meeting at that time."), { statusCode: 409 });
    }

    let requesterEvent = request.requesterEventId
      ? await db.UserCalendarEvent.findOne({ where: { id: request.requesterEventId, businessId } })
      : null;
    let recipientEvent = request.recipientEventId
      ? await db.UserCalendarEvent.findOne({ where: { id: request.recipientEventId, businessId } })
      : null;
    const approvedMetadata = { meetingStatus: "ACCEPTED", approved: true, source: "meeting_request" };
    if (!requesterEvent) {
      requesterEvent = await db.UserCalendarEvent.create({
        businessId,
        employeeUserId: request.requesterUserId,
        organizerUserId: request.requesterUserId,
        meetingRequestId: request.id,
        itemType: "MEETING",
        title: request.title,
        description: request.description,
        location: request.location,
        startAt: request.startAt,
        endAt: request.endAt,
        availabilityStatus: "UNAVAILABLE",
        color: "#2563eb",
        metadata: { ...approvedMetadata, attendeeUserId: request.recipientUserId },
      });
    } else {
      await requesterEvent.update({ color: "#2563eb", metadata: { ...(requesterEvent.metadata || {}), ...approvedMetadata } });
    }
    if (!recipientEvent) {
      recipientEvent = await db.UserCalendarEvent.create({
        businessId,
        employeeUserId: request.recipientUserId,
        organizerUserId: request.requesterUserId,
        meetingRequestId: request.id,
        itemType: "MEETING",
        title: request.title,
        description: request.description,
        location: request.location,
        startAt: request.startAt,
        endAt: request.endAt,
        availabilityStatus: "UNAVAILABLE",
        color: "#2563eb",
        metadata: { ...approvedMetadata, attendeeUserId: request.requesterUserId },
      });
    } else {
      await recipientEvent.update({ color: "#2563eb", metadata: { ...(recipientEvent.metadata || {}), ...approvedMetadata } });
    }
    await request.update({
      status,
      requesterEventId: requesterEvent.id,
      recipientEventId: recipientEvent.id,
      responseNote: data.responseNote || null,
      respondedAt: new Date(),
    });
    await this.googleSync.syncUpdateFromBlih(requesterEvent, { id: request.requesterUserId, businessId });
    await this.googleSync.syncUpdateFromBlih(recipientEvent, { id: request.recipientUserId, businessId });
    await this.notifyMeetingResponse(businessId, request, true);
    return request.reload({ include: this.meetingIncludes() });
  }

  getGoogleAuthUrl(businessId: string, userId: string) {
    return this.googleSync.getAuthUrl(businessId, userId);
  }

  async handleGoogleCallback(code: string, state: string) {
    return this.googleSync.handleCallback(code, state);
  }

  async getGoogleConnection(businessId: string, userId: string) {
    return this.googleSync.getConnection(businessId, userId);
  }

  async disconnectGoogle(businessId: string, userId: string) {
    await this.googleSync.disconnect(businessId, userId);
  }

  async syncEventToGoogle(businessId: string, userId: string, eventId: string) {
    if (eventId.startsWith("project-task:")) throw Object.assign(new Error("Open the task in Project Management to sync it."), { statusCode: 400 });
    const event = await db.UserCalendarEvent.findOne({ where: { id: eventId, businessId, employeeUserId: userId } });
    if (!event) throw Object.assign(new Error("Calendar event not found."), { statusCode: 404 });
    return this.googleSync.syncUpdateFromBlih(event, { id: userId, businessId });
  }

  async syncAllEventsToGoogle(businessId: string, userId: string) {
    const events = await db.UserCalendarEvent.findAll({
      where: { businessId, employeeUserId: userId },
      order: [["startAt", "ASC"]],
    });
    const synced: any[] = [];
    const failed: Array<{ id: string; title: string; message: string }> = [];
    for (const event of events) {
      try {
        const result = await this.googleSync.syncUpdateFromBlih(event, { id: userId, businessId });
        if (result.googleSyncStatus === "SYNCED") synced.push(result);
        else failed.push({ id: event.id, title: event.title, message: result.googleSyncError || result.googleSyncStatus });
      } catch (err: any) {
        failed.push({ id: event.id, title: event.title, message: err?.message || "Sync failed" });
      }
    }
    return { syncedCount: synced.length, failedCount: failed.length, failed };
  }

  async syncFromGoogle(businessId: string, userId: string) {
    return this.googleSync.syncFromGoogle({ id: userId, businessId });
  }

  private async listCalendarEvents(businessId: string, userId: string, query: any = {}) {
    const where: any = { businessId, employeeUserId: userId };
    if (query.from || query.to) {
      const from = query.from ? assertDate(query.from, "from") : new Date("1970-01-01T00:00:00.000Z");
      const to = query.to ? assertDate(query.to, "to") : new Date("2999-12-31T23:59:59.999Z");
      where.startAt = { [Op.lt]: to };
      where.endAt = { [Op.gt]: from };
    }
    if (query.availabilityStatus) {
      assertAvailability(String(query.availabilityStatus));
      where.availabilityStatus = query.availabilityStatus;
    }
    return db.UserCalendarEvent.findAll({ where, order: [["startAt", "ASC"]] });
  }

  private async listProjectTaskCalendarRows(businessId: string, userId: string, query: any = {}) {
    const employee = await db.EmployeeRecord.findOne({ where: { businessId, userId } });
    const where: any = {
      businessId,
      [Op.or]: [{ assignedToUserId: userId }, ...(employee ? [{ assigneeEmployeeId: employee.id }] : [])],
      startDate: { [Op.not]: null },
      dueDate: { [Op.not]: null },
    };
    const tasks = await db.ProjectTask.findAll({
      where,
      include: [{ model: db.Project, attributes: ["id", "title", "code", "status"] }],
      order: [["startDate", "ASC"]],
      limit: 500,
    });
    const linkedIds = (await db.UserCalendarEvent.findAll({
      where: { businessId, employeeUserId: userId, projectTaskId: { [Op.in]: tasks.map((task: any) => task.id) } },
      attributes: ["projectTaskId"],
    })).map((event: any) => event.projectTaskId);
    const linked = new Set(linkedIds);
    return tasks.filter((task: any) => !linked.has(task.id)).map((task: any) => ({
      id: `project-task:${task.id}`,
      businessId,
      employeeUserId: userId,
      itemType: "TASK",
      source: "PROJECT_TASK",
      title: task.title,
      description: task.description,
      startAt: new Date(`${task.startDate}T09:00:00.000Z`).toISOString(),
      endAt: endOfDate(task.dueDate).toISOString(),
      allDay: true,
      availabilityStatus: "AVAILABLE",
      color: "#7c3aed",
      projectId: task.projectId,
      projectTaskId: task.id,
      project: task.Project ? { id: task.Project.id, title: task.Project.title, code: task.Project.code, status: task.Project.status } : null,
      readOnly: false,
      metadata: { projectTaskStatus: task.status, projectTaskPriority: task.priority },
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }));
  }

  private async createProjectTaskForCalendarEvent(businessId: string, userId: string, event: any, projectId: string | null) {
    const project = projectId ? await this.ensureProjectAccess(businessId, userId, projectId) : await this.ensurePersonalProject(businessId, userId);
    const employee = await db.EmployeeRecord.findOne({ where: { businessId, userId } });
    return db.ProjectTask.create({
      businessId,
      projectId: project.id,
      assignedToUserId: userId,
      assigneeEmployeeId: employee?.id || null,
      title: event.title,
      description: event.description,
      startDate: ymd(event.startAt),
      dueDate: ymd(event.endAt),
      status: "TODO",
      priority: "MEDIUM",
      metadata: { calendarEventId: event.id, source: "calendar" },
    });
  }

  private async syncProjectTaskFromCalendarEvent(businessId: string, userId: string, event: any) {
    const task = await db.ProjectTask.findOne({ where: { id: event.projectTaskId, businessId } });
    if (!task) return;
    await task.update({
      title: event.title,
      description: event.description,
      startDate: ymd(event.startAt),
      dueDate: ymd(event.endAt),
      metadata: { ...(task.metadata || {}), calendarEventId: event.id },
    });
  }

  private async updateProjectTaskCalendarRow(businessId: string, userId: string, taskId: string, data: any) {
    const employee = await db.EmployeeRecord.findOne({ where: { businessId, userId } });
    const task = await db.ProjectTask.findOne({
      where: {
        id: taskId,
        businessId,
        [Op.or]: [{ assignedToUserId: userId }, ...(employee ? [{ assigneeEmployeeId: employee.id }] : [])],
      },
    });
    if (!task) throw Object.assign(new Error("Project task not found."), { statusCode: 404 });
    const payload: any = {};
    if (data.title !== undefined) payload.title = String(data.title || "").trim() || task.title;
    if (data.description !== undefined) payload.description = data.description || null;
    if (data.startAt !== undefined) payload.startDate = ymd(assertDate(data.startAt, "startAt"));
    if (data.endAt !== undefined) payload.dueDate = ymd(assertDate(data.endAt, "endAt"));
    await task.update(payload);
    return {
      id: `project-task:${task.id}`,
      businessId,
      employeeUserId: userId,
      itemType: "TASK",
      source: "PROJECT_TASK",
      title: task.title,
      description: task.description,
      startAt: new Date(`${task.startDate}T09:00:00.000Z`).toISOString(),
      endAt: endOfDate(task.dueDate).toISOString(),
      allDay: true,
      availabilityStatus: "AVAILABLE",
      color: "#7c3aed",
      projectId: task.projectId,
      projectTaskId: task.id,
      readOnly: false,
      metadata: task.metadata || {},
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }

  private async ensurePersonalProject(businessId: string, userId: string) {
    const existing = await db.Project.findOne({
      where: { businessId, projectManagerUserId: userId, type: "personal", title: "Personal Tasks" },
    });
    if (existing) return existing;
    return db.Project.create({
      businessId,
      projectManagerUserId: userId,
      title: "Personal Tasks",
      type: "personal",
      status: "ACTIVE",
      priority: "NORMAL",
      metadata: { source: "calendar_personal_tasks" },
    });
  }

  private async ensureProjectAccess(businessId: string, userId: string, projectId: string) {
    const project = await db.Project.findOne({ where: { id: projectId, businessId } });
    if (!project) throw Object.assign(new Error("Project not found."), { statusCode: 404 });
    const employee = await db.EmployeeRecord.findOne({ where: { businessId, userId } });
    if (project.projectManagerUserId === userId || project.ownerEmployeeId === employee?.id || project.managerEmployeeId === employee?.id) return project;
    if (employee) {
      const member = await db.ProjectMember.findOne({ where: { businessId, projectId, employeeId: employee.id } });
      if (member) return project;
    }
    throw Object.assign(new Error("You cannot add tasks to this project."), { statusCode: 403 });
  }

  private async hasUnavailableConflict(businessId: string, userId: string, startAt: Date, endAt: Date, ignoredMeetingRequestId?: string) {
    const where: any = {
      businessId,
      employeeUserId: userId,
      availabilityStatus: "UNAVAILABLE",
      startAt: { [Op.lt]: endAt },
      endAt: { [Op.gt]: startAt },
    };
    if (ignoredMeetingRequestId) where.meetingRequestId = { [Op.ne]: ignoredMeetingRequestId };
    return Boolean(await db.UserCalendarEvent.findOne({ where }));
  }

  private async hasMeetingConflict(businessId: string, userId: string, startAt: Date, endAt: Date, ignoredMeetingRequestId?: string) {
    const where: any = {
      businessId,
      employeeUserId: userId,
      itemType: "MEETING",
      startAt: { [Op.lt]: endAt },
      endAt: { [Op.gt]: startAt },
    };
    if (ignoredMeetingRequestId) where.meetingRequestId = { [Op.ne]: ignoredMeetingRequestId };
    return Boolean(await db.UserCalendarEvent.findOne({ where }));
  }

  private async notifyMeetingResponse(businessId: string, request: any, accepted: boolean) {
    const recipient = await db.User.findOne({ where: { id: request.recipientUserId, businessId } });
    await InternalNotifier.send({
      businessId,
      senderUserId: request.recipientUserId,
      recipientUserId: request.requesterUserId,
      moduleKey: "attendance",
      type: "calendar_meeting_response",
      title: accepted ? "Meeting accepted" : "Meeting declined",
      message: `${recipient?.fullName || "Your teammate"} ${accepted ? "accepted" : "declined"}: ${request.title}.`,
      entityType: "user_calendar_meeting_request",
      entityId: request.id,
      priority: "normal",
    });
  }

  private meetingIncludes() {
    return [
      { model: db.User, as: "requester", attributes: ["id", "fullName", "email"] },
      { model: db.User, as: "recipient", attributes: ["id", "fullName", "email"] },
    ];
  }

}
