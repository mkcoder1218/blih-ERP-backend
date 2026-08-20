import crypto from "crypto";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { Op } from "sequelize";
import { db } from "../../models";
import { AttendanceDailyReportService } from "../../services/attendanceDailyReport.service";
import { AttendanceWeeklyReportService } from "../../services/attendanceWeeklyReport.service";
import { toCsv } from "../../utils/csv";
import { env } from "../../config/env";

const execFileAsync = promisify(execFile);

type BotType = "ATTENDANCE_SUMMARY" | "LATE_REASON" | "PERSONAL_SUMMARY" | "DATABASE_BACKUP";
const MAIN_BOT_TYPE: BotType = "PERSONAL_SUMMARY";
const DATABASE_BACKUP_BOT_TYPE: BotType = "DATABASE_BACKUP";

const DEFAULT_SETTINGS: Record<BotType, any> = {
  ATTENDANCE_SUMMARY: { enabled: false, sendTime: "20:00", timezone: "UTC", chatId: null, botToken: null },
  LATE_REASON: { enabled: false, sendTime: null, timezone: "UTC", chatId: null, botToken: null },
  PERSONAL_SUMMARY: { enabled: false, sendTime: null, timezone: "UTC", chatId: null, botToken: null },
  DATABASE_BACKUP: { enabled: false, sendTime: "02:00", timezone: "UTC", chatId: null, botToken: null }
};

const LINK_HELP_TEXT = "To link Telegram with ERP: open ERP, go to Attendance, click Link Telegram Account, copy the short code, then send /link CODE here.";

function maskToken(token?: string | null) {
  if (!token) return null;
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

function localDateYmd(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function localTimeHhmm(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function hhmmToMinutes(value: string) {
  const [hour, minute] = normalizeHhmm(value).split(":").map(Number);
  return hour * 60 + minute;
}

function minutesLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.abs(minutes % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

function normalizeHhmm(value: any, fallback = "20:00") {
  const raw = String(value || "").trim();
  const twentyFourHour = raw.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (twentyFourHour) return `${twentyFourHour[1].padStart(2, "0")}:${twentyFourHour[2]}`;

  const twelveHour = raw.match(/^(\d{1,2}):([0-5]\d)\s*([AP]M)$/i);
  if (twelveHour) {
    let hour = Number(twelveHour[1]);
    const minute = twelveHour[2];
    const suffix = twelveHour[3].toUpperCase();
    if (hour < 1 || hour > 12) throw Object.assign(new Error("Report send time is invalid"), { statusCode: 400 });
    if (suffix === "PM" && hour !== 12) hour += 12;
    if (suffix === "AM" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${minute}`;
  }

  if (!raw) return fallback;
  throw Object.assign(new Error("Report send time must be like 20:00 or 8:00 PM"), { statusCode: 400 });
}

function assertBotType(botType: string): asserts botType is BotType {
  if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, botType)) {
    throw Object.assign(new Error("Unknown Telegram bot type"), { statusCode: 400 });
  }
}

function mainMenuKeyboard(linked: boolean) {
  const rows = linked
    ? [
        [{ text: "Check In", callback_data: "attendance:check_in" }, { text: "Check Out", callback_data: "attendance:check_out" }],
        [{ text: "Add late reason", callback_data: "reason:late" }, { text: "Add unavailability", callback_data: "reason:unavailable" }],
        [{ text: "Today", callback_data: "summary:today" }, { text: "This week", callback_data: "summary:week" }],
        [{ text: "This month", callback_data: "summary:month" }, { text: "Unlink", callback_data: "account:unlink" }]
      ]
    : [[{ text: "Link account", callback_data: "account:link" }]];
  return { inline_keyboard: rows };
}

function replyKeyboard() {
  return {
    keyboard: [["Check In", "Check Out"], ["Add late reason", "Add unavailability"], ["Today", "This week", "This month"], ["Link account", "Unlink"]],
    resize_keyboard: true,
    one_time_keyboard: false,
    input_field_placeholder: "Tap a button or paste your link code"
  };
}

function locationKeyboard(actionLabel: string) {
  return {
    keyboard: [[{ text: "Share phone location", request_location: true }], ["Cancel"]],
    resize_keyboard: true,
    one_time_keyboard: false,
    input_field_placeholder: `${actionLabel}: share your current location`
  };
}

function parseCoordinates(text: string) {
  const match = String(text || "").trim().match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

async function telegramRequest(botToken: string, method: string, body: any) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.description || `Telegram ${method} failed`);
  return data;
}

async function telegramGetUpdates(botToken: string, offset?: number | null) {
  const query = new URLSearchParams({ timeout: "0", allowed_updates: JSON.stringify(["message", "edited_message", "callback_query"]) });
  if (offset) query.set("offset", String(offset));
  const res = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?${query.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.description || "Telegram getUpdates failed");
  return Array.isArray(data.result) ? data.result : [];
}

async function telegramMultipart(botToken: string, method: string, fields: Record<string, string>, file: { name: string; content: string | Uint8Array; type: string }) {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, value));
  const content =
    typeof file.content === "string"
      ? file.content
      : file.content.buffer.slice(file.content.byteOffset, file.content.byteOffset + file.content.byteLength) as ArrayBuffer;
  form.append("document", new Blob([content], { type: file.type }), file.name);
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, { method: "POST", body: form as any });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.description || `Telegram ${method} failed`);
  return data;
}

export class AttendanceTelegramService {
  private dailyReport = new AttendanceDailyReportService();
  private weeklyReport = new AttendanceWeeklyReportService();

  async getSettings(businessId: string) {
    const rows = await db.TelegramBotSetting.findAll({ where: { businessId } });
    const byType = new Map<string, any>(rows.map((r: any) => [r.botType, r]));
    const legacySummary = byType.get("ATTENDANCE_SUMMARY");
    const main = byType.get(MAIN_BOT_TYPE);
    const mainRaw = main
      ? main.toJSON()
      : {
          businessId,
          botType: MAIN_BOT_TYPE,
          ...DEFAULT_SETTINGS[MAIN_BOT_TYPE],
          chatId: legacySummary?.chatId || null,
          sendTime: legacySummary?.sendTime || "20:00",
          timezone: legacySummary?.timezone || "UTC",
          enabled: Boolean(legacySummary?.enabled)
        };
    const backup = byType.get(DATABASE_BACKUP_BOT_TYPE);
    const backupRaw = backup
      ? backup.toJSON()
      : {
          businessId,
          botType: DATABASE_BACKUP_BOT_TYPE,
          ...DEFAULT_SETTINGS[DATABASE_BACKUP_BOT_TYPE]
        };

    return [
      { ...mainRaw, botToken: undefined, botTokenMasked: maskToken(mainRaw.botToken || legacySummary?.botToken) },
      { ...backupRaw, botToken: undefined, botTokenMasked: maskToken(backupRaw.botToken) }
    ];
  }

  async upsertSetting(businessId: string, botType: BotType, payload: any) {
    assertBotType(botType);
    const effectiveBotType = botType === DATABASE_BACKUP_BOT_TYPE ? DATABASE_BACKUP_BOT_TYPE : MAIN_BOT_TYPE;
    const defaults = { ...DEFAULT_SETTINGS[effectiveBotType], sendTime: effectiveBotType === DATABASE_BACKUP_BOT_TYPE ? "02:00" : "20:00" };
    const [row] = await db.TelegramBotSetting.findOrCreate({ where: { businessId, botType: effectiveBotType }, defaults: { businessId, botType: effectiveBotType, ...defaults } });
    const legacySummary = await db.TelegramBotSetting.findOne({ where: { businessId, botType: "ATTENDANCE_SUMMARY" } });
    const update: any = {
      enabled: Boolean(payload.enabled),
      chatId: payload.chatId ?? null,
      timezone: payload.timezone || defaults.timezone,
      sendTime: normalizeHhmm(payload.sendTime, "20:00")
    };
    if (effectiveBotType === DATABASE_BACKUP_BOT_TYPE) {
      update.lastSentForDate = null;
      update.lastSentAt = null;
    }
    if (typeof payload.botToken === "string" && payload.botToken.trim()) update.botToken = payload.botToken.trim();
    else if (effectiveBotType === MAIN_BOT_TYPE && !row.botToken && legacySummary?.botToken) update.botToken = legacySummary.botToken;
    await row.update(update);
    const raw = row.toJSON();
    return { ...raw, botToken: undefined, botTokenMasked: maskToken(raw.botToken) };
  }

  async generateLinkCode(userId: string, businessId: string) {
    const code = crypto.randomBytes(3).toString("hex").toUpperCase();
    await db.TelegramLinkCode.create({
      businessId,
      userId,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    });
    return { code, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() };
  }

  async unlinkUser(userId: string, businessId: string) {
    await db.TelegramAccountLink.update({ isActive: false, unlinkedAt: new Date() }, { where: { userId, businessId, isActive: true } });
    return { unlinked: true };
  }

  async adminUnlinkUser(businessId: string, userId: string) {
    return this.unlinkUser(userId, businessId);
  }

  async sendTest(businessId: string, botType: BotType) {
    assertBotType(botType);
    const setting = botType === DATABASE_BACKUP_BOT_TYPE
      ? await db.TelegramBotSetting.findOne({ where: { businessId, botType: DATABASE_BACKUP_BOT_TYPE, enabled: true } })
      : await this.getMainSetting(businessId, true);
    if (!setting?.botToken) throw Object.assign(new Error("Telegram bot token is not configured"), { statusCode: 400 });
    if (!setting.chatId) throw Object.assign(new Error("Telegram chat ID or group ID is not configured"), { statusCode: 400 });

    if (botType === DATABASE_BACKUP_BOT_TYPE) {
      const dateYmd = localDateYmd(new Date(), setting.timezone || "UTC");
      await this.sendDatabaseBackup(setting, dateYmd, true);
      return { sent: true };
    }

    if (botType === "ATTENDANCE_SUMMARY" || botType === MAIN_BOT_TYPE) {
      const dateYmd = localDateYmd(new Date(), setting.timezone || "UTC");
      await this.sendDailySummaryCsv(businessId, dateYmd, setting, true);
      return { sent: true };
    }

    const text = "Telegram attendance bot test from Blih. Employees can use /start for attendance actions and summaries.";
    await this.sendAndLog(setting, "manual_test", { chat_id: setting.chatId, text });
    return { sent: true };
  }

  async sendGroupMessageTest(businessId: string, text: string) {
    const message = String(text || "").trim();
    if (!message) throw Object.assign(new Error("Telegram test message is required"), { statusCode: 400 });
    if (message.length > 4000) throw Object.assign(new Error("Telegram test message is too long"), { statusCode: 400 });

    const setting = await this.getMainSetting(businessId, true);
    if (!setting?.botToken) throw Object.assign(new Error("Telegram bot token is not configured"), { statusCode: 400 });
    if (!setting.chatId) throw Object.assign(new Error("Telegram chat ID or group ID is not configured"), { statusCode: 400 });

    await this.sendAndLog(setting, "punctuality_message_test", { chat_id: setting.chatId, text: message });
    return { sent: true };
  }

  async handleWebhook(businessId: string, update: any) {
    if (update?.callback_query) return this.handleCallbackQuery(businessId, update.callback_query);

    const message = update?.message || update?.edited_message;
    if (!message?.from?.id) return { ignored: true };
    if (message.chat?.type && message.chat.type !== "private") {
      const setting = await this.getMainSetting(businessId, true);
      const text = String(message.text || "").trim().toLowerCase();
      if (setting?.botToken && ["/chatid", "/chatid@blih_attendance_bot"].some((command) => text.startsWith(command))) {
        await telegramRequest(setting.botToken, "sendMessage", {
          chat_id: message.chat.id,
          text: `This group's chat ID is:\n${message.chat.id}\n\nPaste this value into ERP as the Admin/HR Group Chat ID.`
        });
        return { ok: true };
      }
      console.log(`[TelegramPersonalBot] ignored group message for ${businessId} chat=${message.chat.id} type=${message.chat.type}`);
      return { ignored: true };
    }
    const setting = await this.getMainSetting(businessId, true);
    if (!setting?.botToken) return { ignored: true };

    const text = String(message.text || "").trim();
    const chatId = String(message.chat.id);
    const telegramUserId = String(message.from.id);
    const username = message.from.username || null;
    const [command, arg] = text.split(/\s+/, 2);

    const sharedLocation = message.location || message.venue?.location;
    if (sharedLocation) {
      console.log(`[TelegramPersonalBot] location update received for ${businessId} from ${telegramUserId}`);
      return this.handleSharedLocation(businessId, setting, chatId, telegramUserId, sharedLocation);
    }

    if (command === "/start") {
      await this.sendMenu(setting, businessId, chatId, telegramUserId);
      return { ok: true };
    }
    if (["Check In", "/checkin"].includes(text)) return this.requestAttendanceLocation(businessId, setting, chatId, telegramUserId, "CHECK_IN");
    if (["Check Out", "/checkout"].includes(text)) return this.requestAttendanceLocation(businessId, setting, chatId, telegramUserId, "CHECK_OUT");
    if (text === "Share current location" || text === "Share phone location") {
      await this.sendPersonal(setting, chatId, "Telegram did not send your location. On your phone, allow location permission for Telegram, then tap Share phone location again.", false, mainMenuKeyboard(true));
      return { ok: true };
    }
    if (["Add late reason", "Late reason"].includes(text)) return this.showReasonPicker(businessId, setting, chatId, telegramUserId, "late");
    if (["Add unavailability", "Unavailable", "Unavailability"].includes(text)) return this.showReasonPicker(businessId, setting, chatId, telegramUserId, "unavailable");
    if (["Today", "/today"].includes(text)) return this.replyWithSummary(businessId, setting, chatId, telegramUserId, "today");
    if (["This week", "Week", "/week"].includes(text)) return this.replyWithSummary(businessId, setting, chatId, telegramUserId, "week");
    if (["This month", "Month", "/month"].includes(text)) return this.replyWithSummary(businessId, setting, chatId, telegramUserId, "month");
    if (["Link account", "Link"].includes(text)) {
      await this.sendPersonal(setting, chatId, "Paste the one-time code from ERP here. No email or password needed.", false);
      return { ok: true };
    }
    if (["Unlink", "/unlink"].includes(text)) return this.unlinkTelegramChat(businessId, setting, chatId, telegramUserId);
    if (["Cancel"].includes(text)) return this.cancelPendingAction(businessId, setting, chatId, telegramUserId);
    if (command === "/link") return this.linkTelegramUser(businessId, setting, chatId, telegramUserId, username, arg);

    const link = await db.TelegramAccountLink.findOne({ where: { businessId, telegramUserId, isActive: true } });
    if (link?.pendingAction?.kind === "attendance_event_location") {
      const coordinates = parseCoordinates(text);
      if (coordinates) return this.handleSharedLocation(businessId, setting, chatId, telegramUserId, coordinates);
      if (text) {
        await this.sendPersonal(setting, chatId, "I am still waiting for your location. Use Telegram on your phone, or paste coordinates like 9.0100, 38.7600.", false, locationKeyboard(link.pendingAction.type === "CHECK_IN" ? "Check in" : "Check out"));
        return { ok: true };
      }
    }
    if (link?.pendingAction?.kind === "daily_reason_comment") {
      await this.saveDailyReasonFromPending(businessId, setting, chatId, link, text);
      return { ok: true };
    }

    const maybeCode = text.replace(/\s+/g, "").toUpperCase();
    if (/^[A-F0-9]{6}$/.test(maybeCode)) return this.linkTelegramUser(businessId, setting, chatId, telegramUserId, username, maybeCode);

    console.log(`[TelegramPersonalBot] unsupported message for ${businessId}: ${JSON.stringify({ text: message.text || null, hasLocation: Boolean(message.location), hasVenue: Boolean(message.venue), keys: Object.keys(message || {}) })}`);
    await this.sendMenu(setting, businessId, chatId, telegramUserId, "Choose an option below.");
    return { ok: true };
  }

  private async handleCallbackQuery(businessId: string, callback: any) {
    const setting = await this.getMainSetting(businessId, true);
    if (!setting?.botToken) return { ignored: true };
    const chatId = String(callback.message?.chat?.id || callback.from?.id);
    if (callback.message?.chat?.type && callback.message.chat.type !== "private") {
      await telegramRequest(setting.botToken, "answerCallbackQuery", { callback_query_id: callback.id });
      console.log(`[TelegramPersonalBot] ignored group callback for ${businessId} chat=${chatId} type=${callback.message.chat.type}`);
      return { ignored: true };
    }
    const telegramUserId = String(callback.from.id);
    const data = String(callback.data || "");

    const isAttendanceAction = data === "attendance:check_in" || data === "attendance:check_out";
    await telegramRequest(setting.botToken, "answerCallbackQuery", {
      callback_query_id: callback.id,
      ...(isAttendanceAction ? { text: "Use Telegram on your phone to share location for attendance.", show_alert: true } : {})
    });

    if (data === "account:link") {
      await this.sendPersonal(setting, chatId, "Paste the one-time code from ERP here. No email or password needed.", false);
      return { ok: true };
    }
    if (data === "account:unlink") return this.unlinkTelegramChat(businessId, setting, chatId, telegramUserId);
    if (data === "summary:today") return this.replyWithSummary(businessId, setting, chatId, telegramUserId, "today");
    if (data === "summary:week") return this.replyWithSummary(businessId, setting, chatId, telegramUserId, "week");
    if (data === "summary:month") return this.replyWithSummary(businessId, setting, chatId, telegramUserId, "month");
    if (data === "attendance:check_in") return this.requestAttendanceLocation(businessId, setting, chatId, telegramUserId, "CHECK_IN");
    if (data === "attendance:check_out") return this.requestAttendanceLocation(businessId, setting, chatId, telegramUserId, "CHECK_OUT");
    if (data === "reason:late") return this.showReasonPicker(businessId, setting, chatId, telegramUserId, "late");
    if (data === "reason:unavailable") return this.showReasonPicker(businessId, setting, chatId, telegramUserId, "unavailable");
    if (data.startsWith("reason_pick:")) {
      const [, reasonType, reasonId] = data.split(":");
      return this.handleReasonPicked(businessId, setting, chatId, telegramUserId, reasonType as any, reasonId);
    }

    await this.sendMenu(setting, businessId, chatId, telegramUserId);
    return { ok: true };
  }

  private async sendMenu(setting: any, businessId: string, chatId: string, telegramUserId: string, text = "Attendance bot menu") {
    const link = await db.TelegramAccountLink.findOne({ where: { businessId, telegramUserId, isActive: true } });
    await this.sendPersonal(setting, chatId, link ? text : LINK_HELP_TEXT, true, mainMenuKeyboard(Boolean(link)));
  }

  private async requestAttendanceLocation(businessId: string, setting: any, chatId: string, telegramUserId: string, type: "CHECK_IN" | "CHECK_OUT") {
    const link = await db.TelegramAccountLink.findOne({ where: { businessId, telegramUserId, isActive: true } });
    if (!link) {
      await this.sendPersonal(setting, chatId, "Link your ERP account before using Telegram attendance.", true, mainMenuKeyboard(false));
      return { ok: true };
    }
    await link.update({ pendingAction: { kind: "attendance_event_location", type } });
    await this.sendPersonal(
      setting,
      chatId,
      `${type === "CHECK_IN" ? "Check in" : "Check out"} needs your phone location. Open Telegram on your phone, allow Telegram location permission if asked, then tap Share phone location. If Telegram does not send it, paste coordinates like 9.0100, 38.7600.`,
      true,
      locationKeyboard(type === "CHECK_IN" ? "Check in" : "Check out")
    );
    console.log(`[TelegramPersonalBot] requested ${type} location from ${telegramUserId} for ${businessId}`);
    return { ok: true };
  }

  private async cancelPendingAction(businessId: string, setting: any, chatId: string, telegramUserId: string) {
    const link = await db.TelegramAccountLink.findOne({ where: { businessId, telegramUserId, isActive: true } });
    if (link) await link.update({ pendingAction: null });
    await this.sendPersonal(setting, chatId, "Cancelled.", true, mainMenuKeyboard(Boolean(link)));
    return { ok: true };
  }

  private async handleSharedLocation(businessId: string, setting: any, chatId: string, telegramUserId: string, location: any) {
    const link = await db.TelegramAccountLink.findOne({ where: { businessId, telegramUserId, isActive: true } });
    if (!link) {
      await this.sendPersonal(setting, chatId, "Link your ERP account before using Telegram attendance.", true, mainMenuKeyboard(false));
      return { ok: true };
    }
    const pending = link.pendingAction;
    if (pending?.kind !== "attendance_event_location") {
      await this.sendPersonal(setting, chatId, "Choose Check In or Check Out first, then share your location.", true, mainMenuKeyboard(true));
      return { ok: true };
    }
    await this.sendPersonal(setting, chatId, "Location received. Checking your attendance area...", false);
    try {
      const { AttendanceMeService } = require("../attendanceMe/attendanceMe.service");
      const result = await new AttendanceMeService().createEvent(link.userId, businessId, {
        type: pending.type,
        latitude: Number(location.latitude),
        longitude: Number(location.longitude)
      });
      await link.update({ pendingAction: null });
      const label = pending.type === "CHECK_IN" ? "Checked in" : "Checked out";
      const latest = result.timeline?.[result.timeline.length - 1];
      const distance = latest?.distanceMeters != null ? ` Distance: ${Math.round(Number(latest.distanceMeters))}m.` : "";
      await this.sendPersonal(setting, chatId, `${label} successfully.${distance}`, true, mainMenuKeyboard(true));
      return { ok: true };
    } catch (err: any) {
      const message = err?.message || "Attendance action failed.";
      if (message.includes("Outside allowed workplace radius")) {
        await this.sendPersonal(setting, chatId, "You are outside the allowed office area. Add a late/outside-area reason or ask HR to enable remote/field attendance for this case.", true, mainMenuKeyboard(true));
      } else if (message.includes("Late check-in requires a reason")) {
        await this.sendPersonal(setting, chatId, "You are late today. Add a late reason first, then tap Check In again.", true, mainMenuKeyboard(true));
      } else {
        await this.sendPersonal(setting, chatId, message, true, mainMenuKeyboard(true));
      }
      return { ok: true };
    }
  }

  private async replyWithSummary(businessId: string, setting: any, chatId: string, telegramUserId: string, range: "today" | "week" | "month") {
    const link = await db.TelegramAccountLink.findOne({ where: { businessId, telegramUserId, isActive: true } });
    if (!link) {
      await this.sendPersonal(setting, chatId, LINK_HELP_TEXT, true, mainMenuKeyboard(false));
      return { ok: true };
    }
    await this.sendPersonal(setting, chatId, "Loading your attendance summary...", false);
    const summary = await this.buildPersonalSummary(businessId, link.userId, range);
    await this.sendPersonal(setting, chatId, summary, true, mainMenuKeyboard(true));
    return { ok: true };
  }

  private async unlinkTelegramChat(businessId: string, setting: any, chatId: string, telegramUserId: string) {
    const link = await db.TelegramAccountLink.findOne({ where: { businessId, telegramUserId, isActive: true } });
    if (link) await link.update({ isActive: false, unlinkedAt: new Date() });
    await this.sendPersonal(setting, chatId, "Disconnecting Telegram access...", false);
    await this.sendPersonal(setting, chatId, "Telegram access has been disconnected.", true, mainMenuKeyboard(false));
    return { ok: true };
  }

  private async showReasonPicker(businessId: string, setting: any, chatId: string, telegramUserId: string, reasonType: "late" | "unavailable") {
    const link = await db.TelegramAccountLink.findOne({ where: { businessId, telegramUserId, isActive: true } });
    if (!link) {
      await this.sendPersonal(setting, chatId, "Link your ERP account before adding attendance reasons.", true, mainMenuKeyboard(false));
      return { ok: true };
    }
    await this.sendPersonal(setting, chatId, "Loading attendance reasons...", false);
    const reasons = await db.AttendanceLateReason.findAll({ where: { businessId, isActive: true, enabled: true }, order: [["sortOrder", "ASC"], ["name", "ASC"]] });
    if (!reasons.length) {
      await this.sendPersonal(setting, chatId, "No active attendance reasons are configured yet.", true, mainMenuKeyboard(true));
      return { ok: true };
    }
    const rows = reasons.map((reason: any) => [{ text: reason.name, callback_data: `reason_pick:${reasonType}:${reason.id}` }]);
    rows.push([{ text: "Back to menu", callback_data: "menu" }]);
    await this.sendPersonal(
      setting,
      chatId,
      reasonType === "late" ? "Choose a late reason to add for today." : "Choose an unavailability reason to add for today.",
      false,
      { inline_keyboard: rows }
    );
    return { ok: true };
  }

  private async handleReasonPicked(businessId: string, setting: any, chatId: string, telegramUserId: string, reasonType: "late" | "unavailable", reasonId: string) {
    const link = await db.TelegramAccountLink.findOne({ where: { businessId, telegramUserId, isActive: true } });
    if (!link) {
      await this.sendPersonal(setting, chatId, "Link your ERP account before adding attendance reasons.", true, mainMenuKeyboard(false));
      return { ok: true };
    }
    const reason = await db.AttendanceLateReason.findOne({ where: { id: reasonId, businessId, isActive: true, enabled: true } });
    if (!reason) {
      await this.sendPersonal(setting, chatId, "That reason is no longer available.", true, mainMenuKeyboard(true));
      return { ok: true };
    }
    if (reason.requiresComment) {
      await link.update({ pendingAction: { kind: "daily_reason_comment", reasonType, reasonId } });
      await this.sendPersonal(setting, chatId, `Add a short comment for "${reason.name}".`, false);
      return { ok: true };
    }
    await this.sendPersonal(setting, chatId, "Saving your reason...", false);
    await this.createDailyReason(businessId, link.userId, reasonType, reasonId, null, "telegram");
    await this.sendPersonal(setting, chatId, `${reasonType === "late" ? "Late" : "Unavailability"} reason added for today: ${reason.name}`, true, mainMenuKeyboard(true));
    return { ok: true };
  }

  private async saveDailyReasonFromPending(businessId: string, setting: any, chatId: string, link: any, comment: string) {
    const pending = link.pendingAction;
    const reason = await db.AttendanceLateReason.findOne({ where: { id: pending.reasonId, businessId, isActive: true, enabled: true } });
    if (!reason) {
      await link.update({ pendingAction: null });
      await this.sendPersonal(setting, chatId, "That reason is no longer available.", true, mainMenuKeyboard(true));
      return;
    }
    await this.sendPersonal(setting, chatId, "Saving your reason...", false);
    await this.createDailyReason(businessId, link.userId, pending.reasonType, pending.reasonId, comment.trim() || null, "telegram");
    await link.update({ pendingAction: null });
    await this.sendPersonal(setting, chatId, `${pending.reasonType === "late" ? "Late" : "Unavailability"} reason added for today: ${reason.name}`, true, mainMenuKeyboard(true));
  }

  private async createDailyReason(businessId: string, userId: string, reasonType: "late" | "unavailable", reasonId: string | null, comment: string | null, source: string) {
    const settings = await db.BusinessAttendanceSettings.findOne({ where: { businessId } });
    const dateYmd = localDateYmd(new Date(), settings?.timezone || "UTC");
    const record = await db.AttendanceDailyReason.create({
      businessId,
      employeeId: userId,
      dateYmd,
      reasonType,
      lateReasonId: reasonId,
      comment,
      source
    });
    if (reasonType === "late") {
      this.notifyDailyLateReason(businessId, userId, record.id).catch((err) => {
        console.error(`[TelegramLateReason] notification failed for daily reason ${record.id}: ${err.message}`);
      });
    }
    if (reasonType === "unavailable") {
      const reason = reasonId ? await db.AttendanceLateReason.findByPk(reasonId) : null;
      await db.AttendanceRequest.create({
        businessId,
        employeeUserId: userId,
        requestType: "not_available",
        category: reason?.name || "Unavailable",
        title: reason?.name || "Unavailable",
        reason: comment || reason?.description || reason?.name || "Unavailable",
        status: "pending"
      });
    }
    return record;
  }

  private async notifyDailyLateReason(businessId: string, employeeId: string, dailyReasonId: string) {
    const setting = await this.getMainSetting(businessId, true);
    if (!setting?.botToken || !setting.chatId) return;

    const dailyReason = await db.AttendanceDailyReason.findByPk(dailyReasonId, {
      include: [{ model: db.AttendanceLateReason, as: "lateReason", attributes: ["id", "name", "requiresComment"] }]
    });
    if (!dailyReason) return;

    const employee = await db.User.findOne({ where: { id: employeeId, businessId } });
    const record = await db.EmployeeRecord.findOne({ where: { businessId, userId: employeeId }, include: [{ model: db.Department, as: "department" }] });
    const reason = dailyReason.comment
      ? `${dailyReason.lateReason?.name || "Custom reason"} - ${dailyReason.comment}`
      : dailyReason.lateReason?.name || "Custom reason";

    const msg = [
      "Late reason submitted",
      `Employee: ${employee?.fullName || "Unknown"}`,
      `Date: ${dailyReason.dateYmd}`,
      "Check-in: Not checked in yet",
      "Late duration: Pending check-in",
      `Reason: ${reason}`,
      `Department: ${record?.department?.name || "N/A"}`,
      "Attendance mode: Pending check-in",
      `Source: ${dailyReason.source || "telegram"}`
    ].join("\n");

    await this.sendAndLog(setting, "late_reason_submitted_precheckin", { chat_id: setting.chatId, text: msg });
  }

  async pollPersonalBotUpdates() {
    const settings = await db.TelegramBotSetting.findAll({ where: { botType: MAIN_BOT_TYPE, enabled: true } });
    console.log(`[TelegramPersonalBot] enabled personal bot configs: ${settings.length}`);
    for (const setting of settings) {
      if (!setting.botToken) {
        console.log(`[TelegramPersonalBot] skipped ${setting.businessId}: missing token`);
        continue;
      }

      let updates: any[] = [];
      try {
        updates = await telegramGetUpdates(setting.botToken, setting.updateOffset);
      } catch (err: any) {
        console.error(`[TelegramPersonalBot] getUpdates failed for ${setting.businessId}: ${err.message}`);
        continue;
      }

      if (!updates.length) continue;
      console.log(`[TelegramPersonalBot] processing ${updates.length} update(s) for ${setting.businessId}`);

      let nextOffset = Number(setting.updateOffset || 0);
      for (const update of updates) {
        const updateId = Number(update.update_id);
        if (Number.isFinite(updateId)) nextOffset = Math.max(nextOffset, updateId + 1);
        try {
          const message = update.message || update.edited_message;
          console.log(
            `[TelegramPersonalBot] update ${update.update_id} kind=${update.callback_query ? "callback_query" : update.edited_message ? "edited_message" : update.message ? "message" : "unknown"} text=${message?.text ? JSON.stringify(String(message.text).slice(0, 60)) : "-"} location=${Boolean(message?.location || message?.venue?.location)}`
          );
          await this.handleWebhook(setting.businessId, update);
        } catch (err: any) {
          const details = Array.isArray(err?.errors)
            ? ` ${err.errors.map((item: any) => `${item.path || "field"}: ${item.message}`).join("; ")}`
            : "";
          console.error(`[TelegramPersonalBot] update ${update.update_id} failed for ${setting.businessId}: ${err.message}${details}`);
        }
      }
      await setting.update({ updateOffset: nextOffset });
    }
  }

  private async linkTelegramUser(businessId: string, setting: any, chatId: string, telegramUserId: string, username: string | null, code?: string) {
    if (!code) {
      await this.sendPersonal(setting, chatId, "Send /link CODE using the code generated inside ERP.");
      return { ok: true };
    }
    await this.sendPersonal(setting, chatId, "Checking your link code...", false);
    const row = await db.TelegramLinkCode.findOne({
      where: { businessId, codeHash: hashCode(code), usedAt: null, expiresAt: { [Op.gt]: new Date() } }
    });
    if (!row) {
      await this.sendPersonal(setting, chatId, "That link code is invalid or expired. Generate a new code in ERP.");
      return { ok: true };
    }
    await db.sequelize.transaction(async (transaction: any) => {
      await row.update({ usedAt: new Date() }, { transaction });
      const existingLinks = await db.TelegramAccountLink.findAll({
        where: {
          businessId,
          [Op.or]: [{ userId: row.userId }, { telegramUserId }]
        },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      const primary = existingLinks[0] || null;
      const payload = {
        businessId,
        userId: row.userId,
        telegramUserId,
        telegramChatId: chatId,
        telegramUsername: username,
        pendingAction: null,
        isActive: true,
        linkedAt: new Date(),
        unlinkedAt: null
      };
      if (primary) {
        for (const extra of existingLinks.slice(1)) await extra.destroy({ transaction });
        await primary.update(payload, { transaction });
      } else {
        await db.TelegramAccountLink.create(payload, { transaction });
      }
    });
    await this.sendPersonal(setting, chatId, "Your Telegram account is linked.", true, mainMenuKeyboard(true));
    return { ok: true };
  }

  async notifyLateReason(businessId: string, employeeId: string, attendanceEventId: string, explanationId: string) {
    const setting = await this.getMainSetting(businessId, true);
    if (!setting?.botToken || !setting.chatId) return;
    const employee = await db.User.findOne({ where: { id: employeeId, businessId } });
    const event = await db.AttendanceEvent.findByPk(attendanceEventId);
    const explanation = await db.AttendanceLateExplanation.findByPk(explanationId, { include: [{ model: db.AttendanceLateReason, as: "reason" }] });
    const record = await db.EmployeeRecord.findOne({ where: { businessId, userId: employeeId }, include: [{ model: db.Department, as: "department" }] });
    const settings = await db.BusinessAttendanceSettings.findOne({ where: { businessId } });
    const tz = settings?.timezone || "UTC";
    const reason = explanation?.customReason || explanation?.reason?.name || "No reason provided";
    const msg = [
      "Late reason submitted",
      `Employee: ${employee?.fullName || "Unknown"}`,
      `Date: ${localDateYmd(new Date(event.timestampUtc), tz)}`,
      `Check-in: ${localTimeHhmm(new Date(event.timestampUtc), tz)} (${tz})`,
      `Late duration: ${minutesLabel(explanation.lateByMinutes || 0)}`,
      `Reason: ${reason}`,
      `Department: ${record?.department?.name || "N/A"}`,
      `Attendance mode: ${event?.withinAllowedRadius ? "office" : "field"}`
    ].join("\n");
    await this.sendAndLog(setting, "late_reason_submitted", { chat_id: setting.chatId, text: msg });
  }

  async sendAttendanceGroupMessage(businessId: string, text: string, eventType = "attendance_group_message") {
    const setting = await this.getMainSetting(businessId, true);
    if (!setting?.botToken || !setting.chatId) {
      throw Object.assign(new Error("Telegram attendance group is not configured"), { statusCode: 400 });
    }
    await this.sendAndLog(setting, eventType, { chat_id: setting.chatId, text });
    return { sent: true };
  }

  async runDailySummarySweep(now = new Date()) {
    const settings = await db.TelegramBotSetting.findAll({ where: { botType: MAIN_BOT_TYPE, enabled: true } });
    console.log(`[TelegramAttendanceSummary] enabled summary configs: ${settings.length}`);
    for (const setting of settings) {
      if (!setting.botToken || !setting.chatId || !setting.sendTime) {
        console.log(`[TelegramAttendanceSummary] skipped ${setting.businessId}: missing token/chat/time`);
        continue;
      }
      const ymd = localDateYmd(now, setting.timezone || "UTC");
      if (setting.lastSentForDate === ymd) {
        console.log(`[TelegramAttendanceSummary] skipped ${setting.businessId}: already sent for ${ymd}`);
        continue;
      }
      const currentMinutes = hhmmToMinutes(localTimeHhmm(now, setting.timezone || "UTC"));
      const scheduledMinutes = hhmmToMinutes(setting.sendTime);
      if (currentMinutes < scheduledMinutes) {
        console.log(`[TelegramAttendanceSummary] waiting ${setting.businessId}: now ${localTimeHhmm(now, setting.timezone || "UTC")} < ${setting.sendTime} (${setting.timezone || "UTC"})`);
        continue;
      }
      console.log(`[TelegramAttendanceSummary] sending ${setting.businessId}: ${ymd} at ${localTimeHhmm(now, setting.timezone || "UTC")} (${setting.timezone || "UTC"})`);
      try {
        await this.sendDailySummaryCsv(setting.businessId, ymd, setting);
        await setting.update({ lastSentForDate: ymd, lastSentAt: new Date() });
        console.log(`[TelegramAttendanceSummary] sent ${setting.businessId}: ${ymd} to ${setting.chatId}`);
      } catch (err: any) {
        console.error(`[TelegramAttendanceSummary] failed for ${setting.businessId}: ${err.message}`);
      }
    }
  }

  async runDatabaseBackupSweep(now = new Date()) {
    const settings = await db.TelegramBotSetting.findAll({ where: { botType: DATABASE_BACKUP_BOT_TYPE, enabled: true } });
    console.log(`[TelegramDatabaseBackup] enabled backup configs: ${settings.length}`);
    for (const setting of settings) {
      if (!setting.botToken || !setting.chatId || !setting.sendTime) {
        console.log(`[TelegramDatabaseBackup] skipped ${setting.businessId}: missing token/chat/time`);
        continue;
      }
      const timezone = setting.timezone || "UTC";
      const ymd = localDateYmd(now, timezone);
      if (setting.lastSentForDate === ymd) {
        console.log(`[TelegramDatabaseBackup] skipped ${setting.businessId}: already sent for ${ymd}`);
        continue;
      }
      const currentMinutes = hhmmToMinutes(localTimeHhmm(now, timezone));
      const scheduledMinutes = hhmmToMinutes(setting.sendTime);
      if (currentMinutes < scheduledMinutes) {
        console.log(`[TelegramDatabaseBackup] waiting ${setting.businessId}: now ${localTimeHhmm(now, timezone)} < ${setting.sendTime} (${timezone})`);
        continue;
      }

      try {
        console.log(`[TelegramDatabaseBackup] sending ${setting.businessId}: ${ymd} at ${localTimeHhmm(now, timezone)} (${timezone})`);
        await this.sendDatabaseBackup(setting, ymd);
        await setting.update({ lastSentForDate: ymd, lastSentAt: new Date() });
        console.log(`[TelegramDatabaseBackup] sent ${setting.businessId}: ${ymd} to ${setting.chatId}`);
      } catch (err: any) {
        console.error(`[TelegramDatabaseBackup] failed for ${setting.businessId}: ${err.message}`);
      }
    }
  }

  private async sendDatabaseBackup(setting: any, dateYmd: string, isTest = false) {
    const business = await db.Business.findByPk(setting.businessId, { attributes: ["name", "slug"] });
    const safeBusiness = String(business?.slug || business?.name || setting.businessId).replace(/[^a-z0-9_-]+/gi, "_").slice(0, 60);
    const fileName = `${isTest ? "test_" : ""}${safeBusiness}_${env.db.name}_${dateYmd}.dump`;
    const filePath = path.join(os.tmpdir(), fileName);

    try {
      try {
        await execFileAsync(
          env.pgDumpPath,
          [
            "--host", env.db.host,
            "--port", String(env.db.port),
            "--username", env.db.user,
            "--dbname", env.db.name,
            "--format=custom",
            "--no-owner",
            "--file", filePath
          ],
          {
            env: { ...process.env, PGPASSWORD: env.db.password },
            timeout: 10 * 60 * 1000,
            maxBuffer: 1024 * 1024
          }
        );
      } catch (err: any) {
        if (err?.code === "ENOENT") {
          throw Object.assign(
            new Error(`Database backup requires pg_dump, but it was not found at "${env.pgDumpPath}". Install PostgreSQL client tools or set PG_DUMP_PATH to the pg_dump executable.`),
            { statusCode: 500 }
          );
        }
        throw err;
      }

      const content = await fs.readFile(filePath);
      await this.sendAndLog(setting, isTest ? "database_backup_test" : "database_backup", {
        chat_id: setting.chatId,
        caption: `${isTest ? "Test: " : ""}Database backup for ${business?.name || "Blih ERP"}\nDate: ${dateYmd}\nDatabase: ${env.db.name}`,
        document: fileName,
        documentContent: content
      });
    } finally {
      await fs.unlink(filePath).catch(() => null);
    }
  }

  private async sendDailySummaryCsv(businessId: string, dateYmd: string, setting: any, isTest = false) {
    const rows = await this.dailyReport.generate(businessId, { startDate: dateYmd, endDate: dateYmd, audience: "hr" });
    const totalEmployees = rows.length;
    const checkedIn = rows.filter((r: any) => Boolean(r.MorningCheckIn)).length;
    const checkedOut = rows.filter((r: any) => Boolean(r.EveningCheckOut)).length;
    const late = rows.filter((r: any) => r.LatenessStatus === "Late-WithNotice" || r.LatenessStatus === "Late-NoNotice").length;
    const absent = rows.filter((r: any) => r.LatenessStatus === "Absent").length;
    const incomplete = rows.filter((r: any) => r.LatenessStatus === "IncompletePunch").length;
    const workedRows = rows.filter((r: any) => Number(r.NetHoursWorked || 0) > 0);
    const totalWorkedMinutes = workedRows.reduce((sum: number, r: any) => sum + Math.round(Number(r.NetHoursWorked || 0) * 60), 0);
    const averageWorkedMinutes = workedRows.length > 0 ? Math.round(totalWorkedMinutes / workedRows.length) : 0;
    const summary = [
      `${isTest ? "Test: " : ""}Overall attendance summary`,
      `Date: ${dateYmd}`,
      `Employees: ${totalEmployees}`,
      `Checked in: ${checkedIn}`,
      `Checked out: ${checkedOut}`,
      `Late: ${late}`,
      `Absent: ${absent}`,
      `Incomplete punches: ${incomplete}`,
      `Average worked: ${minutesLabel(averageWorkedMinutes)}`,
      "",
      "CSV report attached below."
    ].join("\n");
    console.log(`[TelegramAttendanceSummary] sending overall summary message to ${setting.chatId} for ${businessId} ${dateYmd}`);
    await this.sendAndLog(setting, "daily_attendance_overall_summary", { chat_id: setting.chatId, text: summary });

    const headers = ["date", "employeeName", "department", "assignedStartTime", "employmentCategory", "morningCheckIn", "lunchCheckOut", "lunchCheckIn", "eveningCheckOut", "lunchMinutesTaken", "netHoursWorked", "latenessStatus", "minutesLate", "noticeStatus", "deductionApplied", "latenessReasonHrOnly"];
    const csvRows = rows.map((r: any) => ({
      date: r.Date,
      employeeName: r.EmployeeName,
      department: r.Department || "",
      assignedStartTime: r.AssignedStartTime,
      employmentCategory: r.EmploymentCategory || "",
      morningCheckIn: r.MorningCheckIn || "",
      lunchCheckOut: r.LunchCheckOut || "",
      lunchCheckIn: r.LunchCheckIn || "",
      eveningCheckOut: r.EveningCheckOut || "",
      lunchMinutesTaken: r.LunchMinutesTaken ?? "",
      netHoursWorked: Number(r.NetHoursWorked || 0).toFixed(2),
      latenessStatus: r.LatenessStatus,
      minutesLate: r.MinutesLate || 0,
      noticeStatus: r.NoticeStatus,
      deductionApplied: r.DeductionApplied ? "Yes" : "No",
      latenessReasonHrOnly: r.LatenessReason_HROnly || ""
    }));
    const csv = toCsv(csvRows, headers);
    console.log(`[TelegramAttendanceSummary] sending CSV report to ${setting.chatId} for ${businessId} ${dateYmd}`);
    await this.sendAndLog(setting, "daily_attendance_summary_csv", {
      chat_id: setting.chatId,
      caption: `${isTest ? "Test: " : ""}Attendance summary for ${dateYmd}`,
      document: `${isTest ? "test-" : ""}attendance-summary-${dateYmd}.csv`
    }, csv);
  }

  private async getMainSetting(businessId: string, enabledOnly = false) {
    const main = await db.TelegramBotSetting.findOne({ where: { businessId, botType: MAIN_BOT_TYPE, ...(enabledOnly ? { enabled: true } : {}) } });
    if (main?.botToken) return main;
    return db.TelegramBotSetting.findOne({ where: { businessId, botType: "ATTENDANCE_SUMMARY", ...(enabledOnly ? { enabled: true } : {}) } });
  }

  private async buildPersonalSummary(businessId: string, userId: string, range: "today" | "week" | "month") {
    const settings = await db.BusinessAttendanceSettings.findOne({ where: { businessId } });
    const tz = settings?.timezone || "UTC";
    const now = new Date();
    const today = localDateYmd(now, tz);
    const start = new Date(today + "T00:00:00Z");
    if (range === "week") start.setUTCDate(start.getUTCDate() - 6);
    if (range === "month") start.setUTCDate(1);
    const startYmd = range === "today" ? today : start.toISOString().slice(0, 10);
    if (range === "week") {
      const weeklyRows = await this.weeklyReport.generate(businessId, { startDate: startYmd, endDate: today, employeeId: userId, audience: "public" });
      const user = await db.User.findByPk(userId);
      const row = weeklyRows[0];
      if (!row) {
        return [
          `${user?.fullName || "Your"} attendance summary`,
          `Range: ${startYmd} to ${today}`,
          "",
          "No scheduled workdays found."
        ].join("\n");
      }
      return [
        `${user?.fullName || "Your"} weekly attendance summary`,
        `Range: ${row.WeekStartDate} to ${row.WeekEndDate}`,
        `Scheduled days: ${row.ScheduledWorkDays}`,
        `On time: ${row.DaysOnTime}`,
        `Late with notice: ${row.DaysLateWithNotice}`,
        `Late without notice: ${row.DaysLateNoNotice}`,
        `Absent: ${row.DaysAbsent}`,
        `Incomplete punches: ${row.DaysIncompletePunch}`,
        `Lateness notices used: ${row.LatenessNoticesUsed}`,
        `Punctuality: ${row.PunctualityRatePercent}%`,
        `Net worked: ${Number(row.NetHoursWorked || 0).toFixed(2)}h`,
        `Half-day deductions: ${row.HalfDayDeductions}`,
        `Full-day deductions: ${row.FullDayDeductions}`
      ].join("\n");
    }
    const rows = await this.dailyReport.generate(businessId, { startDate: startYmd, endDate: today, employeeId: userId, audience: "public" });
    const user = await db.User.findByPk(userId);
    const total = rows.reduce((sum: number, r: any) => sum + Math.round(Number(r.NetHoursWorked || 0) * 60), 0);
    const late = rows.filter((r: any) => r.LatenessStatus === "Late-WithNotice" || r.LatenessStatus === "Late-NoNotice").length;
    const absence = rows.filter((r: any) => r.LatenessStatus === "Absent").length;
    const incomplete = rows.filter((r: any) => r.LatenessStatus === "IncompletePunch").length;
    const checkins = rows.map((r: any) => `${r.Date}: ${r.MorningCheckIn || "--"} - ${r.EveningCheckOut || "--"} (${r.LatenessStatus})`).join("\n");
    return [
      `${user?.fullName || "Your"} attendance summary`,
      `Range: ${startYmd} to ${today}`,
      `Total worked: ${minutesLabel(total)}`,
      `Late count: ${late}`,
      `Absence count: ${absence}`,
      `Incomplete punches: ${incomplete}`,
      "",
      checkins || "No attendance records found."
    ].join("\n");
  }

  private async sendPersonal(setting: any, chatId: string, text: string, withReplyKeyboard = true, inlineKeyboard?: any) {
    const payload: any = { chat_id: chatId, text };
    if (inlineKeyboard) payload.reply_markup = inlineKeyboard;
    else if (withReplyKeyboard) payload.reply_markup = replyKeyboard();
    await this.sendAndLog(setting, "personal_command_reply", payload);
  }

  private async sendAndLog(setting: any, eventType: string, payload: any, csv?: string) {
    const { documentContent, ...logPayload } = payload || {};
    const log = await db.TelegramNotificationLog.create({ businessId: setting.businessId, botType: setting.botType, recipientChatId: payload.chat_id, eventType, status: "pending", payload: logPayload });
    try {
      if (csv || payload.documentContent) {
        await telegramMultipart(
          setting.botToken,
          "sendDocument",
          { chat_id: String(payload.chat_id), caption: payload.caption || "" },
          { name: payload.document, content: payload.documentContent || csv, type: payload.documentContent ? "application/octet-stream" : "text/csv" }
        );
      } else {
        await telegramRequest(setting.botToken, "sendMessage", payload);
      }
      await log.update({ status: "sent", sentAt: new Date() });
    } catch (err: any) {
      await log.update({ status: "failed", errorMessage: err.message });
      throw err;
    }
  }
}
