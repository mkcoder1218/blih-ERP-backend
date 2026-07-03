import { randomUUID } from "crypto";
import { Op } from "sequelize";
import { db } from "../../models";

const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const DEFAULT_TIME_ZONE = process.env.COMPANY_TIMEZONE || process.env.TZ || "UTC";

type GoogleSyncUser = { id: string; businessId: string; timeZone?: string; timezone?: string };
type GoogleEvent = {
  id?: string;
  etag?: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  updated?: string;
  transparency?: string;
  htmlLink?: string;
  recurringEventId?: string;
  recurrence?: string[];
  originalStartTime?: { date?: string; dateTime?: string; timeZone?: string };
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
};
type GoogleEventListResult = { events: GoogleEvent[]; nextSyncToken?: string };
type RetryActionType =
  | "CREATE_GOOGLE_EVENT"
  | "UPDATE_GOOGLE_EVENT"
  | "DELETE_GOOGLE_EVENT"
  | "IMPORT_GOOGLE_EVENT"
  | "UPDATE_BLIH_FROM_GOOGLE"
  | "DELETE_BLIH_FROM_GOOGLE"
  | "RENEW_GOOGLE_WATCH";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function googleAllDayDate(value?: string) {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function googleSettingKey(userId: string) {
  return `google_calendar:${userId}`;
}

function googleConfig() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw Object.assign(new Error("Google Calendar sync is not configured."), { statusCode: 503 });
  }
  return { clientId, clientSecret, redirectUri };
}

async function googleFetch(url: string, init: RequestInit, parseJson = true) {
  const resp = await fetch(url, init);
  const body = parseJson ? await resp.json().catch(() => ({})) : null;
  if (!resp.ok) {
    throw Object.assign(new Error((body as any)?.error_description || (body as any)?.error?.message || "Google API request failed."), {
      statusCode: 502,
      googleStatus: resp.status,
    });
  }
  return body;
}

function googleWebhookAddress() {
  const explicit = process.env.GOOGLE_CALENDAR_WEBHOOK_URL;
  if (explicit) return explicit;
  const base = process.env.BACKEND_URL || process.env.API_BASE_URL || process.env.PUBLIC_API_URL;
  if (!base) {
    throw Object.assign(new Error("Google Calendar webhook URL is not configured."), { statusCode: 503 });
  }
  return `${base.replace(/\/$/, "")}/api/v1/google-calendar/webhook`;
}

function nextRetryDate(attemptCount: number) {
  const minutes = Math.min(60, 2 ** Math.max(0, attemptCount));
  return new Date(Date.now() + minutes * 60_000);
}

export class GoogleCalendarSyncService {
  getAuthUrl(businessId: string, userId: string) {
    const cfg = googleConfig();
    const state = Buffer.from(JSON.stringify({ businessId, userId, ts: Date.now() })).toString("base64url");
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", cfg.clientId);
    url.searchParams.set("redirect_uri", cfg.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", GOOGLE_SCOPE);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    return { url: url.toString() };
  }

  async handleCallback(code: string, state: string) {
    const cfg = googleConfig();
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    const token = await googleFetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        redirect_uri: cfg.redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const key = googleSettingKey(parsed.userId);
    const existingValue = (await db.BusinessSetting.findOne({ where: { businessId: parsed.businessId, key } }))?.value || {};
    const value = {
      ...existingValue,
      accessToken: (token as any).access_token,
      refreshToken: (token as any).refresh_token || existingValue.refreshToken,
      expiresAt: Date.now() + Number((token as any).expires_in || 3600) * 1000,
      scope: (token as any).scope,
      calendarId: existingValue.calendarId || "primary",
      connectedAt: new Date().toISOString(),
    };
    const existing = await db.BusinessSetting.findOne({ where: { businessId: parsed.businessId, key } });
    if (existing) await existing.update({ value, category: "calendar", isPublic: false });
    else await db.BusinessSetting.create({ businessId: parsed.businessId, key, value, category: "calendar", isPublic: false });
    await this.syncFromGoogle({ businessId: parsed.businessId, id: parsed.userId }).catch((err) => {
      console.error(`[GoogleCalendarSync] initial import failed for ${parsed.userId}:`, err?.message || err);
    });
    await this.setupCalendarWatch(parsed.userId, parsed.businessId).catch(async (err) => {
      const setting = await db.BusinessSetting.findOne({ where: { businessId: parsed.businessId, key } });
      if (setting) {
        await setting.update({
          value: {
            ...(setting.value || {}),
            watchStatus: "WATCH_FAILED",
            watchError: String(err?.message || "Google Calendar watch setup failed").slice(0, 1000),
          },
        });
      }
      console.error(`[GoogleCalendarSync] watch setup failed for ${parsed.userId}:`, err?.message || err);
    });
    return parsed;
  }

  async getConnection(businessId: string, userId: string) {
    const setting = await db.BusinessSetting.findOne({ where: { businessId, key: googleSettingKey(userId) } });
    return {
      connected: Boolean(setting),
      calendarId: setting?.value?.calendarId || "primary",
      connectedAt: setting?.value?.connectedAt || null,
      watchStatus: setting?.value?.watchStatus || (setting?.value?.watchChannelId ? "ACTIVE" : "NOT_CONFIGURED"),
      watchExpiresAt: setting?.value?.watchExpiresAt || null,
      needsReconnect: setting?.value?.watchStatus === "NEEDS_RECONNECT",
    };
  }

  async disconnect(businessId: string, userId: string) {
    const setting = await db.BusinessSetting.findOne({ where: { businessId, key: googleSettingKey(userId) } });
    if (setting) await this.stopCalendarWatch(userId, businessId).catch(() => undefined);
    if (setting) await setting.destroy();
  }

  async syncCreateFromBlih(event: any, user: { id: string; businessId: string }) {
    return this.syncUpsert(event, user, { actionType: "CREATE_GOOGLE_EVENT" });
  }

  async syncUpdateFromBlih(event: any, user: { id: string; businessId: string }) {
    return this.syncUpsert(event, user, { actionType: "UPDATE_GOOGLE_EVENT" });
  }

  async syncDeleteFromBlih(event: any, user: { id: string; businessId: string }) {
    if (!event?.googleEventId) return true;
    try {
      const { token, setting } = await this.refreshGoogleAccessToken(user);
      const calendarId = event.googleCalendarId || setting.value?.calendarId || "primary";
      await googleFetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.googleEventId)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
        false
      );
      await this.logSync({
        businessId: user.businessId,
        userId: user.id,
        localEventId: event.id,
        googleEventId: event.googleEventId,
        direction: "BLIH_TO_GOOGLE",
        action: "DELETE",
        status: "SUCCESS",
        message: "Deleted Google Calendar event from Blih deletion.",
      });
      return true;
    } catch (err: any) {
      await this.enqueueRetry({
        businessId: user.businessId,
        userId: user.id,
        localEventId: event.id,
        googleEventId: event.googleEventId,
        actionType: "DELETE_GOOGLE_EVENT",
        payload: { googleCalendarId: event.googleCalendarId },
        error: err,
      });
      await this.logSync({
        businessId: user.businessId,
        userId: user.id,
        localEventId: event.id,
        googleEventId: event.googleEventId,
        direction: "BLIH_TO_GOOGLE",
        action: "DELETE",
        status: "FAILED",
        message: "Failed to delete Google Calendar event.",
        errorDetails: err?.message || String(err),
      });
      console.error(`[GoogleCalendarSync] delete failed for ${event.id}:`, err?.message || err);
      return false;
    }
  }

  async syncFromGoogle(user: GoogleSyncUser) {
    const access = await this.refreshGoogleAccessToken(user);
    if (!access.connected || !access.token || !access.setting) {
      throw Object.assign(new Error("Google Calendar is not connected."), { statusCode: 400 });
    }

    const calendarId = access.setting.value?.calendarId || "primary";
    const timeMin = addDays(new Date(), -30);
    const timeMax = addDays(new Date(), 180);
    const googleResult = await this.fetchGoogleEvents(user, timeMin, timeMax);
    const summary = {
      importedCount: 0,
      updatedCount: 0,
      deletedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      errors: [] as Array<{ googleEventId?: string; message: string }>,
    };

    for (const googleEvent of googleResult.events) {
      try {
        if (googleEvent.status === "cancelled") {
          const deleted = await this.handleDeletedGoogleEvent(googleEvent, user);
          if (deleted) summary.deletedCount += 1;
          else summary.skippedCount += 1;
          continue;
        }

        const result = await this.importGoogleEventToBlih({ ...googleEvent, calendarId }, user);
        if (result === "imported") summary.importedCount += 1;
        else if (result === "updated") summary.updatedCount += 1;
        else summary.skippedCount += 1;
      } catch (err: any) {
        summary.failedCount += 1;
        await this.enqueueRetry({
          businessId: user.businessId,
          userId: user.id,
          googleEventId: googleEvent.id,
          actionType: googleEvent.status === "cancelled" ? "DELETE_BLIH_FROM_GOOGLE" : "IMPORT_GOOGLE_EVENT",
          payload: { googleEvent, calendarId },
          error: err,
        });
        summary.errors.push({ googleEventId: googleEvent.id, message: err?.message || "Google event import failed" });
      }
    }

    if (googleResult.nextSyncToken) {
      await access.setting.update({
        value: {
          ...(access.setting.value || {}),
          calendarId,
          syncToken: googleResult.nextSyncToken,
          lastGoogleImportSyncAt: new Date().toISOString(),
          watchStatus: access.setting.value?.watchStatus || "NOT_CONFIGURED",
        },
      });
    }

    return summary;
  }

  async fetchGoogleEvents(user: GoogleSyncUser, timeMin: Date, timeMax: Date) {
    const access = await this.refreshGoogleAccessToken(user);
    if (!access.connected || !access.token || !access.setting) {
      throw Object.assign(new Error("Google Calendar is not connected."), { statusCode: 400 });
    }
    const calendarId = access.setting.value?.calendarId || "primary";
    const events: GoogleEvent[] = [];
    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;

    do {
      const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
      url.searchParams.set("timeMin", timeMin.toISOString());
      url.searchParams.set("timeMax", timeMax.toISOString());
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("showDeleted", "true");
      url.searchParams.set("orderBy", "startTime");
      url.searchParams.set("maxResults", "2500");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const body = await googleFetch(url.toString(), { headers: { Authorization: `Bearer ${access.token}` } });
      events.push(...(((body as any).items || []) as GoogleEvent[]));
      pageToken = (body as any).nextPageToken || undefined;
      nextSyncToken = (body as any).nextSyncToken || nextSyncToken;
    } while (pageToken);

    return { events, nextSyncToken } satisfies GoogleEventListResult;
  }

  async setupCalendarWatch(userId: string, businessId?: string) {
    const setting = await this.findGoogleSetting(userId, businessId);
    if (!setting) throw Object.assign(new Error("Google Calendar is not connected."), { statusCode: 400 });
    const user = { id: userId, businessId: setting.businessId };
    const access = await this.refreshGoogleAccessToken(user);
    if (!access.connected || !access.token || !access.setting) {
      throw Object.assign(new Error("Google Calendar is not connected."), { statusCode: 400 });
    }

    const value = access.setting.value || {};
    if (!value.syncToken) await this.syncFromGoogle(user);
    const latestSetting = await this.findGoogleSetting(userId, setting.businessId);
    const latestValue = latestSetting?.value || value;
    const calendarId = latestValue.calendarId || "primary";
    const watchToken = randomUUID();
    const channelId = `blih-${userId}-${Date.now()}-${randomUUID()}`.slice(0, 180);
    const watch = await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/watch`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: channelId,
        type: "web_hook",
        address: googleWebhookAddress(),
        token: watchToken,
      }),
    });

    const watchExpiresAt = (watch as any).expiration ? new Date(Number((watch as any).expiration)).toISOString() : null;
    await access.setting.update({
      value: {
        ...(access.setting.value || {}),
        calendarId,
        syncToken: latestValue.syncToken || access.setting.value?.syncToken,
        watchChannelId: channelId,
        watchResourceId: (watch as any).resourceId,
        watchToken,
        watchExpiresAt,
        watchStatus: "ACTIVE",
        watchError: null,
        watchUpdatedAt: new Date().toISOString(),
      },
    });
    return access.setting.reload();
  }

  async renewCalendarWatch(userId: string, businessId?: string) {
    const setting = await this.findGoogleSetting(userId, businessId);
    if (!setting) throw Object.assign(new Error("Google Calendar is not connected."), { statusCode: 400 });
    await this.stopCalendarWatch(userId, setting.businessId).catch((err) => {
      console.error(`[GoogleCalendarSync] stop before renew failed for ${userId}:`, err?.message || err);
    });
    return this.setupCalendarWatch(userId, setting.businessId);
  }

  async stopCalendarWatch(userId: string, businessId?: string) {
    const setting = await this.findGoogleSetting(userId, businessId);
    if (!setting) return;
    const value = setting.value || {};
    if (!value.watchChannelId || !value.watchResourceId) return;
    try {
      const access = await this.refreshGoogleAccessToken({ id: userId, businessId: setting.businessId });
      if (access.connected && access.token) {
        await googleFetch(
          "https://www.googleapis.com/calendar/v3/channels/stop",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${access.token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ id: value.watchChannelId, resourceId: value.watchResourceId }),
          },
          false
        );
      }
    } catch (err: any) {
      console.error(`[GoogleCalendarSync] watch stop failed for ${userId}:`, err?.message || err);
    } finally {
      await setting.update({
        value: {
          ...(setting.value || {}),
          watchChannelId: null,
          watchResourceId: null,
          watchToken: null,
          watchExpiresAt: null,
          watchStatus: "STOPPED",
          watchUpdatedAt: new Date().toISOString(),
        },
      });
    }
  }

  async handleGoogleWebhook(headers: Record<string, any>, _body?: any) {
    const channelId = this.headerValue(headers, "x-goog-channel-id");
    const resourceId = this.headerValue(headers, "x-goog-resource-id");
    const resourceState = this.headerValue(headers, "x-goog-resource-state");
    const channelToken = this.headerValue(headers, "x-goog-channel-token");
    if (!channelId || !resourceId) {
      throw Object.assign(new Error("Invalid Google Calendar webhook headers."), { statusCode: 400 });
    }

    const setting = await db.BusinessSetting.findOne({
      where: {
        category: "calendar",
        value: {
          [Op.contains]: {
            watchChannelId: channelId,
            watchResourceId: resourceId,
          },
        },
      } as any,
    });
    if (!setting) {
      throw Object.assign(new Error("Google Calendar watch channel was not recognized."), { statusCode: 404 });
    }
    const value = setting.value || {};
    if (value.watchToken && channelToken !== value.watchToken) {
      throw Object.assign(new Error("Google Calendar webhook token did not match."), { statusCode: 403 });
    }

    const userId = this.userIdFromSetting(setting);
    if (!userId) throw Object.assign(new Error("Google Calendar watch user was not recognized."), { statusCode: 400 });
    if (resourceState === "sync") {
      await setting.update({ value: { ...value, watchLastNotificationAt: new Date().toISOString() } });
      return { ignored: true, resourceState };
    }

    const result = await this.syncGoogleChanges(userId, value.calendarId || "primary", setting.businessId);
    await setting.reload();
    await setting.update({
      value: {
        ...(setting.value || {}),
        watchLastNotificationAt: new Date().toISOString(),
        watchStatus: "ACTIVE",
        watchError: null,
      },
    });
    return { ...result, resourceState };
  }

  async syncGoogleChanges(userId: string, calendarId = "primary", businessId?: string) {
    const setting = await this.findGoogleSetting(userId, businessId);
    if (!setting) throw Object.assign(new Error("Google Calendar is not connected."), { statusCode: 400 });
    const syncToken = setting.value?.syncToken;
    if (!syncToken) return this.handleInvalidSyncToken(userId, setting.businessId);

    try {
      const result = await this.fetchGoogleEventsBySyncToken({ id: userId, businessId: setting.businessId }, calendarId, syncToken);
      const summary = await this.importGoogleEvents(result.events, { id: userId, businessId: setting.businessId }, calendarId);
      if (result.nextSyncToken) {
        await setting.update({
          value: {
            ...(setting.value || {}),
            calendarId,
            syncToken: result.nextSyncToken,
            lastGoogleIncrementalSyncAt: new Date().toISOString(),
            watchStatus: "ACTIVE",
            watchError: null,
          },
        });
      }
      return summary;
    } catch (err: any) {
      if (err?.googleStatus === 410 || /sync token/i.test(String(err?.message || ""))) {
        return this.handleInvalidSyncToken(userId, setting.businessId);
      }
      await setting.update({
        value: {
          ...(setting.value || {}),
          watchStatus: err?.googleStatus === 401 || err?.googleStatus === 403 ? "NEEDS_RECONNECT" : "SYNC_FAILED",
          watchError: String(err?.message || "Google Calendar incremental sync failed").slice(0, 1000),
        },
      });
      throw err;
    }
  }

  async handleInvalidSyncToken(userId: string, businessId?: string) {
    const setting = await this.findGoogleSetting(userId, businessId);
    if (!setting) throw Object.assign(new Error("Google Calendar is not connected."), { statusCode: 400 });
    await setting.update({
      value: {
        ...(setting.value || {}),
        syncToken: null,
        watchStatus: "RESYNCING",
        watchError: null,
      },
    });
    return this.syncFromGoogle({ id: userId, businessId: setting.businessId });
  }

  async fetchGoogleEventsBySyncToken(user: GoogleSyncUser, calendarId: string, syncToken: string) {
    const access = await this.refreshGoogleAccessToken(user);
    if (!access.connected || !access.token || !access.setting) {
      throw Object.assign(new Error("Google Calendar is not connected."), { statusCode: 400 });
    }
    const events: GoogleEvent[] = [];
    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;

    do {
      const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
      url.searchParams.set("syncToken", syncToken);
      url.searchParams.set("showDeleted", "true");
      url.searchParams.set("maxResults", "2500");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const body = await googleFetch(url.toString(), { headers: { Authorization: `Bearer ${access.token}` } });
      events.push(...(((body as any).items || []) as GoogleEvent[]));
      pageToken = (body as any).nextPageToken || undefined;
      nextSyncToken = (body as any).nextSyncToken || nextSyncToken;
    } while (pageToken);

    return { events, nextSyncToken } satisfies GoogleEventListResult;
  }

  private async importGoogleEvents(googleEvents: GoogleEvent[], user: GoogleSyncUser, calendarId: string) {
    const summary = {
      importedCount: 0,
      updatedCount: 0,
      deletedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      errors: [] as Array<{ googleEventId?: string; message: string }>,
    };
    for (const googleEvent of googleEvents) {
      try {
        if (googleEvent.status === "cancelled") {
          const deleted = await this.handleDeletedGoogleEvent(googleEvent, user);
          if (deleted) summary.deletedCount += 1;
          else summary.skippedCount += 1;
          continue;
        }
        const result = await this.importGoogleEventToBlih({ ...googleEvent, calendarId }, user);
        if (result === "imported") summary.importedCount += 1;
        else if (result === "updated") summary.updatedCount += 1;
        else summary.skippedCount += 1;
      } catch (err: any) {
        summary.failedCount += 1;
        await this.enqueueRetry({
          businessId: user.businessId,
          userId: user.id,
          googleEventId: googleEvent.id,
          actionType: googleEvent.status === "cancelled" ? "DELETE_BLIH_FROM_GOOGLE" : "UPDATE_BLIH_FROM_GOOGLE",
          payload: { googleEvent, calendarId },
          error: err,
        });
        summary.errors.push({ googleEventId: googleEvent.id, message: err?.message || "Google event import failed" });
      }
    }
    return summary;
  }

  private async findGoogleSetting(userId: string, businessId?: string) {
    const where: any = { key: googleSettingKey(userId) };
    if (businessId) where.businessId = businessId;
    return db.BusinessSetting.findOne({ where });
  }

  private userIdFromSetting(setting: any) {
    const key = String(setting?.key || "");
    return key.startsWith("google_calendar:") ? key.slice("google_calendar:".length) : null;
  }

  private headerValue(headers: Record<string, any>, name: string) {
    const value = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
    return Array.isArray(value) ? String(value[0] || "") : value ? String(value) : "";
  }

  async importGoogleEventToBlih(googleEvent: GoogleEvent & { calendarId?: string }, user: GoogleSyncUser) {
    if (!googleEvent.id) return "skipped" as const;
    const existing = await db.UserCalendarEvent.findOne({
      where: { businessId: user.businessId, employeeUserId: user.id, googleEventId: googleEvent.id },
      paranoid: false,
    });

    if (existing) {
      if (existing.deletedAt && typeof existing.restore === "function") await existing.restore();
      return this.updateBlihEventFromGoogle(googleEvent, existing, user);
    }

    const payload = this.mapGoogleEventToBlihPayload(googleEvent, user);
    await db.UserCalendarEvent.create({
      businessId: user.businessId,
      employeeUserId: user.id,
      organizerUserId: user.id,
      ...payload,
    });
    await this.logSync({
      businessId: user.businessId,
      userId: user.id,
      googleEventId: googleEvent.id,
      direction: "GOOGLE_TO_BLIH",
      action: "IMPORT",
      status: "SUCCESS",
      message: "Imported Google Calendar event into Blih.",
      metadata: { recurringEventId: googleEvent.recurringEventId || null },
    });
    return "imported" as const;
  }

  async updateBlihEventFromGoogle(googleEvent: GoogleEvent & { calendarId?: string }, blihEvent: any, user: GoogleSyncUser) {
    if (blihEvent.googleETag && googleEvent.etag && blihEvent.googleETag === googleEvent.etag) return "skipped" as const;
    const googleUpdatedAt = googleEvent.updated ? new Date(googleEvent.updated) : null;
    const lastSyncedAt = blihEvent.lastGoogleSyncedAt ? new Date(blihEvent.lastGoogleSyncedAt) : null;
    const blihUpdatedAt = blihEvent.updatedAt ? new Date(blihEvent.updatedAt) : null;
    const bothChanged =
      lastSyncedAt &&
      googleUpdatedAt &&
      blihUpdatedAt &&
      googleUpdatedAt > lastSyncedAt &&
      blihUpdatedAt > lastSyncedAt;
    if (bothChanged) {
      await blihEvent.update({ googleSyncStatus: "SYNC_CONFLICT" });
      await this.logSync({
        businessId: user.businessId,
        userId: user.id,
        localEventId: blihEvent.id,
        googleEventId: googleEvent.id,
        direction: "GOOGLE_TO_BLIH",
        action: "CONFLICT",
        status: "SUCCESS",
        message: "Both Blih and Google changed after last sync. Latest update wins.",
        metadata: { blihUpdatedAt, googleUpdatedAt, lastSyncedAt },
      });
      if (blihUpdatedAt && googleUpdatedAt && blihUpdatedAt > googleUpdatedAt) {
        await this.syncUpsert(blihEvent, user, { actionType: "UPDATE_GOOGLE_EVENT" });
        return "updated" as const;
      }
    }
    await blihEvent.update(this.mapGoogleEventToBlihPayload(googleEvent, user));
    await this.logSync({
      businessId: user.businessId,
      userId: user.id,
      localEventId: blihEvent.id,
      googleEventId: googleEvent.id,
      direction: "GOOGLE_TO_BLIH",
      action: "UPDATE",
      status: "SUCCESS",
      message: "Updated Blih event from Google Calendar.",
    });
    return "updated" as const;
  }

  async handleDeletedGoogleEvent(googleEvent: GoogleEvent, user: GoogleSyncUser) {
    if (!googleEvent.id) return false;
    const event = await db.UserCalendarEvent.findOne({
      where: { businessId: user.businessId, employeeUserId: user.id, googleEventId: googleEvent.id },
    });
    if (!event) return false;
    await event.update({ deletedSource: "GOOGLE", googleDeletedAt: new Date(), googleSyncStatus: "SYNCED" });
    await event.destroy();
    await this.logSync({
      businessId: user.businessId,
      userId: user.id,
      localEventId: event.id,
      googleEventId: googleEvent.id,
      direction: "GOOGLE_TO_BLIH",
      action: "DELETE",
      status: "SUCCESS",
      message: "Soft-deleted Blih event because Google event was cancelled.",
    });
    return true;
  }

  mapGoogleEventToBlihPayload(googleEvent: GoogleEvent & { calendarId?: string }, user: GoogleSyncUser) {
    const allDay = Boolean(googleEvent.start?.date);
    const startAt = allDay
      ? googleAllDayDate(googleEvent.start?.date)
      : new Date(String(googleEvent.start?.dateTime || ""));
    const endAt = allDay
      ? googleAllDayDate(googleEvent.end?.date || googleEvent.start?.date)
      : new Date(String(googleEvent.end?.dateTime || googleEvent.start?.dateTime || ""));

    if (!startAt || Number.isNaN(startAt.getTime())) {
      throw new Error("Google event has no valid start time.");
    }
    if (!endAt || Number.isNaN(endAt.getTime()) || endAt <= startAt) {
      throw new Error("Google event has no valid end time.");
    }

    return {
      title: String(googleEvent.summary || "Untitled Google event").trim(),
      description: googleEvent.description || null,
      location: googleEvent.location || null,
      startAt,
      endAt,
      allDay,
      itemType: "EVENT",
      availabilityStatus: googleEvent.transparency === "transparent" ? "AVAILABLE" : "UNAVAILABLE",
      color: "#4285f4",
      googleEventId: googleEvent.id,
      googleCalendarId: googleEvent.calendarId || "primary",
      googleSyncStatus: "SYNCED",
      googleSyncError: null,
      lastGoogleSyncedAt: new Date(),
      googleSyncedAt: new Date(),
      syncSource: "GOOGLE",
      googleUpdatedAt: googleEvent.updated ? new Date(googleEvent.updated) : null,
      googleETag: googleEvent.etag || null,
      recurrenceRule: Array.isArray(googleEvent.recurrence) ? googleEvent.recurrence.join("\n") : null,
      googleRecurringEventId: googleEvent.recurringEventId || null,
      googleOriginalStartTime: googleEvent.originalStartTime || null,
      isRecurring: Array.isArray(googleEvent.recurrence) && googleEvent.recurrence.length > 0,
      isRecurringInstance: Boolean(googleEvent.recurringEventId),
      metadata: {
        googleHtmlLink: googleEvent.htmlLink || null,
        googleRecurringEventId: googleEvent.recurringEventId || null,
        googleOriginalStartTime: googleEvent.originalStartTime || null,
        googleImportedAt: new Date().toISOString(),
        source: "google_calendar",
      },
    };
  }

  buildGoogleEventPayload(event: any, user?: any) {
    const timeZone = user?.timeZone || user?.timezone || DEFAULT_TIME_ZONE;
    return {
      summary: event.title,
      description: event.description || undefined,
      location: event.location || undefined,
      transparency: event.availabilityStatus === "AVAILABLE" ? "transparent" : "opaque",
      start: event.allDay
        ? { date: new Date(event.startAt).toISOString().slice(0, 10) }
        : { dateTime: new Date(event.startAt).toISOString(), timeZone },
      end: event.allDay
        ? { date: new Date(event.endAt).toISOString().slice(0, 10) }
        : { dateTime: new Date(event.endAt).toISOString(), timeZone },
    };
  }

  async refreshGoogleAccessToken(user: { id: string; businessId: string }) {
    const setting = await db.BusinessSetting.findOne({ where: { businessId: user.businessId, key: googleSettingKey(user.id) } });
    if (!setting) return { connected: false as const, token: null, setting: null };
    const cfg = googleConfig();
    const value = setting.value || {};
    if (value.accessToken && Number(value.expiresAt || 0) > Date.now() + 60_000) {
      return { connected: true as const, token: value.accessToken as string, setting };
    }
    if (!value.refreshToken) throw Object.assign(new Error("Google Calendar refresh token is missing. Reconnect Google Calendar."), { statusCode: 400 });
    const refreshed = await googleFetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        refresh_token: value.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    value.accessToken = (refreshed as any).access_token;
    value.expiresAt = Date.now() + Number((refreshed as any).expires_in || 3600) * 1000;
    await setting.update({ value });
    return { connected: true as const, token: value.accessToken as string, setting };
  }

  private async syncUpsert(event: any, user: { id: string; businessId: string }, options: { queueOnFail?: boolean; actionType?: RetryActionType } = {}) {
    const queueOnFail = options.queueOnFail !== false;
    const actionType = options.actionType || (event.googleEventId ? "UPDATE_GOOGLE_EVENT" : "CREATE_GOOGLE_EVENT");
    try {
      const access = await this.refreshGoogleAccessToken(user);
      if (!access.connected || !access.token || !access.setting) {
        await event.update({ googleSyncStatus: "NOT_SYNCED", googleSyncError: null });
        return event.reload();
      }
      const calendarId = event.googleCalendarId || access.setting.value?.calendarId || "primary";
      const method = event.googleEventId ? "PATCH" : "POST";
      const url = event.googleEventId
        ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.googleEventId)}`
        : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
      const synced = await googleFetch(url, {
        method,
        headers: { Authorization: `Bearer ${access.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(this.buildGoogleEventPayload(event, user)),
      });
      await event.update({
        googleEventId: (synced as any).id || event.googleEventId,
        googleCalendarId: calendarId,
        googleSyncStatus: "SYNCED",
        googleSyncError: null,
        lastGoogleSyncedAt: new Date(),
        googleSyncedAt: new Date(),
        syncSource: "BLIH",
        googleUpdatedAt: (synced as any).updated ? new Date((synced as any).updated) : event.googleUpdatedAt,
        googleETag: (synced as any).etag || event.googleETag,
      });
      await this.logSync({
        businessId: user.businessId,
        userId: user.id,
        localEventId: event.id,
        googleEventId: (synced as any).id || event.googleEventId,
        direction: "BLIH_TO_GOOGLE",
        action: method === "POST" ? "CREATE" : "UPDATE",
        status: "SUCCESS",
        message: method === "POST" ? "Created Google Calendar event." : "Updated Google Calendar event.",
      });
      return event.reload();
    } catch (err: any) {
      await event.update({
        googleSyncStatus: "FAILED",
        googleSyncError: String(err?.message || "Google Calendar sync failed").slice(0, 4000),
      });
      if (queueOnFail) {
        await this.enqueueRetry({
          businessId: user.businessId,
          userId: user.id,
          localEventId: event.id,
          googleEventId: event.googleEventId,
          actionType,
          payload: { googleCalendarId: event.googleCalendarId },
          error: err,
        });
      }
      await this.logSync({
        businessId: user.businessId,
        userId: user.id,
        localEventId: event.id,
        googleEventId: event.googleEventId,
        direction: "BLIH_TO_GOOGLE",
        action: event.googleEventId ? "UPDATE" : "CREATE",
        status: "FAILED",
        message: "Google Calendar sync failed.",
        errorDetails: err?.message || String(err),
      });
      return event.reload();
    }
  }

  async retrySyncJob(job: any) {
    await job.update({ status: "PROCESSING", attemptCount: Number(job.attemptCount || 0) + 1 });
    try {
      if (job.actionType === "RENEW_GOOGLE_WATCH") {
        await this.renewCalendarWatch(job.userId, job.businessId);
      } else if (job.actionType === "DELETE_GOOGLE_EVENT") {
        const event = job.localEventId ? await db.UserCalendarEvent.findByPk(job.localEventId, { paranoid: false }) : null;
        const deleted = await this.syncDeleteFromBlih(event || { id: job.localEventId, googleEventId: job.googleEventId, googleCalendarId: job.payload?.googleCalendarId }, { id: job.userId, businessId: job.businessId });
        if (!deleted) throw new Error("Google delete retry failed.");
      } else if (job.actionType === "IMPORT_GOOGLE_EVENT" || job.actionType === "UPDATE_BLIH_FROM_GOOGLE") {
        if (job.payload?.googleEvent) await this.importGoogleEventToBlih(job.payload.googleEvent, { id: job.userId, businessId: job.businessId });
      } else {
        const event = await db.UserCalendarEvent.findByPk(job.localEventId, { paranoid: false });
        if (!event) throw new Error("Local calendar event no longer exists.");
        await this.syncUpsert(event, { id: job.userId, businessId: job.businessId }, { queueOnFail: false, actionType: job.actionType });
        await event.reload({ paranoid: false });
        if (event.googleSyncStatus !== "SYNCED") throw new Error(event.googleSyncError || "Retry did not sync the event.");
      }
      await job.update({ status: "SUCCESS", lastError: null });
      await this.logSync({
        businessId: job.businessId,
        userId: job.userId,
        localEventId: job.localEventId,
        googleEventId: job.googleEventId,
        direction: String(job.actionType || "").includes("BLIH") ? "GOOGLE_TO_BLIH" : "BLIH_TO_GOOGLE",
        action: "RETRY",
        status: "SUCCESS",
        message: `Retry job ${job.actionType} succeeded.`,
      });
    } catch (err: any) {
      const attemptCount = Number(job.attemptCount || 1);
      const isDead = attemptCount >= Number(job.maxAttempts || 5);
      await job.update({
        status: isDead ? "DEAD" : "FAILED",
        lastError: String(err?.message || "Retry failed").slice(0, 4000),
        nextRunAt: nextRetryDate(attemptCount),
      });
      await this.logSync({
        businessId: job.businessId,
        userId: job.userId,
        localEventId: job.localEventId,
        googleEventId: job.googleEventId,
        direction: String(job.actionType || "").includes("BLIH") ? "GOOGLE_TO_BLIH" : "BLIH_TO_GOOGLE",
        action: "RETRY",
        status: "FAILED",
        message: `Retry job ${job.actionType} failed.`,
        errorDetails: err?.message || String(err),
      });
    }
  }

  private async enqueueRetry(input: {
    businessId: string;
    userId: string;
    localEventId?: string | null;
    googleEventId?: string | null;
    actionType: RetryActionType;
    payload?: any;
    error?: any;
  }) {
    const existing = await db.CalendarSyncRetryJob.findOne({
      where: {
        businessId: input.businessId,
        userId: input.userId,
        actionType: input.actionType,
        status: { [Op.in]: ["PENDING", "FAILED", "PROCESSING"] },
        ...(input.localEventId ? { localEventId: input.localEventId } : {}),
        ...(input.googleEventId ? { googleEventId: input.googleEventId } : {}),
      },
      order: [["createdAt", "DESC"]],
    });
    const payload = input.payload || {};
    const lastError = String(input.error?.message || input.error || "Sync failed").slice(0, 4000);
    if (existing) {
      await existing.update({
        payload: { ...(existing.payload || {}), ...payload },
        status: existing.status === "PROCESSING" ? "PROCESSING" : "PENDING",
        lastError,
        nextRunAt: nextRetryDate(Number(existing.attemptCount || 0)),
      });
      return existing;
    }
    return db.CalendarSyncRetryJob.create({
      businessId: input.businessId,
      userId: input.userId,
      localEventId: input.localEventId || null,
      googleEventId: input.googleEventId || null,
      actionType: input.actionType,
      payload,
      status: "PENDING",
      nextRunAt: nextRetryDate(0),
      lastError,
    });
  }

  private async logSync(input: {
    businessId: string;
    userId?: string | null;
    localEventId?: string | null;
    googleEventId?: string | null;
    direction: "BLIH_TO_GOOGLE" | "GOOGLE_TO_BLIH";
    action: "CREATE" | "UPDATE" | "DELETE" | "IMPORT" | "CONFLICT" | "RETRY" | "WATCH_RENEW" | "ERROR";
    status: "SUCCESS" | "FAILED" | "SKIPPED";
    message?: string;
    errorDetails?: string;
    metadata?: any;
  }) {
    try {
      await db.CalendarSyncAuditLog.create({
        businessId: input.businessId,
        userId: input.userId || null,
        localEventId: input.localEventId || null,
        googleEventId: input.googleEventId || null,
        direction: input.direction,
        action: input.action,
        status: input.status,
        message: input.message || null,
        errorDetails: input.errorDetails || null,
        metadata: input.metadata || {},
      });
    } catch (err: any) {
      console.error("[GoogleCalendarSync] audit log failed:", err?.message || err);
    }
  }
}
