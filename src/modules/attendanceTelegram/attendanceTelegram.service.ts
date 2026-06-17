import crypto from "crypto";
import { Op } from "sequelize";
import { db } from "../../models";
import { AttendanceHrService } from "../attendanceHr/attendanceHr.service";
import { businessDateEndUtc, businessDateStartUtc } from "../../utils/timezone";
import { toCsv } from "../../utils/csv";

type BotType = "ATTENDANCE_SUMMARY" | "LATE_REASON" | "PERSONAL_SUMMARY";

const DEFAULT_SETTINGS: Record<BotType, any> = {
  ATTENDANCE_SUMMARY: { enabled: false, sendTime: "20:00", timezone: "UTC", chatId: null, botToken: null },
  LATE_REASON: { enabled: false, sendTime: null, timezone: "UTC", chatId: null, botToken: null },
  PERSONAL_SUMMARY: { enabled: false, sendTime: null, timezone: "UTC", chatId: null, botToken: null }
};

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
        [{ text: "Add late reason", callback_data: "reason:late" }, { text: "Add unavailability", callback_data: "reason:unavailable" }],
        [{ text: "Today", callback_data: "summary:today" }, { text: "This week", callback_data: "summary:week" }],
        [{ text: "This month", callback_data: "summary:month" }, { text: "Unlink", callback_data: "account:unlink" }]
      ]
    : [[{ text: "Link account", callback_data: "account:link" }]];
  return { inline_keyboard: rows };
}

function replyKeyboard() {
  return {
    keyboard: [["Add late reason", "Add unavailability"], ["Today", "This week", "This month"], ["Link account", "Unlink"]],
    resize_keyboard: true,
    one_time_keyboard: false,
    input_field_placeholder: "Tap a button or paste your link code"
  };
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
  const query = new URLSearchParams({ timeout: "0", allowed_updates: JSON.stringify(["message", "callback_query"]) });
  if (offset) query.set("offset", String(offset));
  const res = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?${query.toString()}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.description || "Telegram getUpdates failed");
  return Array.isArray(data.result) ? data.result : [];
}

async function telegramMultipart(botToken: string, method: string, fields: Record<string, string>, file: { name: string; content: string; type: string }) {
  const form = new FormData();
  Object.entries(fields).forEach(([key, value]) => form.append(key, value));
  form.append("document", new Blob([file.content], { type: file.type }), file.name);
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, { method: "POST", body: form as any });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.description || `Telegram ${method} failed`);
  return data;
}

export class AttendanceTelegramService {
  private hr = new AttendanceHrService();

  async getSettings(businessId: string) {
    const rows = await db.TelegramBotSetting.findAll({ where: { businessId } });
    const byType = new Map<string, any>(rows.map((r: any) => [r.botType, r]));
    return (Object.keys(DEFAULT_SETTINGS) as BotType[]).map((botType) => {
      const row: any = byType.get(botType);
      const raw = row ? row.toJSON() : { businessId, botType, ...DEFAULT_SETTINGS[botType] };
      return { ...raw, botToken: undefined, botTokenMasked: maskToken(raw.botToken) };
    });
  }

  async upsertSetting(businessId: string, botType: BotType, payload: any) {
    assertBotType(botType);
    const defaults = DEFAULT_SETTINGS[botType];
    const [row] = await db.TelegramBotSetting.findOrCreate({ where: { businessId, botType }, defaults: { businessId, botType, ...defaults } });
    const update: any = {
      enabled: Boolean(payload.enabled),
      chatId: payload.chatId ?? null,
      timezone: payload.timezone || defaults.timezone,
      sendTime: botType === "ATTENDANCE_SUMMARY" ? normalizeHhmm(payload.sendTime, "20:00") : null
    };
    if (typeof payload.botToken === "string" && payload.botToken.trim()) update.botToken = payload.botToken.trim();
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
    const setting = await db.TelegramBotSetting.findOne({ where: { businessId, botType } });
    if (!setting?.botToken) throw Object.assign(new Error("Telegram bot token is not configured"), { statusCode: 400 });
    if (!setting.chatId) throw Object.assign(new Error("Telegram chat ID or group ID is not configured"), { statusCode: 400 });

    if (botType === "ATTENDANCE_SUMMARY") {
      const dateYmd = localDateYmd(new Date(), setting.timezone || "UTC");
      await this.sendDailySummaryCsv(businessId, dateYmd, setting, true);
      return { sent: true };
    }

    const text =
      botType === "LATE_REASON"
        ? "Telegram late reason notification test from Blih attendance."
        : "Telegram personal attendance bot test from Blih. Use /start in Telegram for instructions.";
    await this.sendAndLog(setting, "manual_test", { chat_id: setting.chatId, text });
    return { sent: true };
  }

  async handleWebhook(businessId: string, update: any) {
    if (update?.callback_query) return this.handleCallbackQuery(businessId, update.callback_query);

    const message = update?.message;
    if (!message?.text || !message?.from?.id) return { ignored: true };
    const setting = await db.TelegramBotSetting.findOne({ where: { businessId, botType: "PERSONAL_SUMMARY", enabled: true } });
    if (!setting?.botToken) return { ignored: true };

    const text = String(message.text).trim();
    const chatId = String(message.chat.id);
    const telegramUserId = String(message.from.id);
    const username = message.from.username || null;
    const [command, arg] = text.split(/\s+/, 2);

    if (command === "/start") {
      await this.sendMenu(setting, businessId, chatId, telegramUserId);
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
    if (command === "/link") return this.linkTelegramUser(businessId, setting, chatId, telegramUserId, username, arg);

    const link = await db.TelegramAccountLink.findOne({ where: { businessId, telegramUserId, isActive: true } });
    if (link?.pendingAction?.kind === "daily_reason_comment") {
      await this.saveDailyReasonFromPending(businessId, setting, chatId, link, text);
      return { ok: true };
    }

    const maybeCode = text.replace(/\s+/g, "").toUpperCase();
    if (/^[A-F0-9]{6}$/.test(maybeCode)) return this.linkTelegramUser(businessId, setting, chatId, telegramUserId, username, maybeCode);

    await this.sendMenu(setting, businessId, chatId, telegramUserId, "Choose an option below.");
    return { ok: true };
  }

  private async handleCallbackQuery(businessId: string, callback: any) {
    const setting = await db.TelegramBotSetting.findOne({ where: { businessId, botType: "PERSONAL_SUMMARY", enabled: true } });
    if (!setting?.botToken) return { ignored: true };
    const chatId = String(callback.message?.chat?.id || callback.from?.id);
    const telegramUserId = String(callback.from.id);
    const data = String(callback.data || "");

    await telegramRequest(setting.botToken, "answerCallbackQuery", { callback_query_id: callback.id });

    if (data === "account:link") {
      await this.sendPersonal(setting, chatId, "Paste the one-time code from ERP here. No email or password needed.", false);
      return { ok: true };
    }
    if (data === "account:unlink") return this.unlinkTelegramChat(businessId, setting, chatId, telegramUserId);
    if (data === "summary:today") return this.replyWithSummary(businessId, setting, chatId, telegramUserId, "today");
    if (data === "summary:week") return this.replyWithSummary(businessId, setting, chatId, telegramUserId, "week");
    if (data === "summary:month") return this.replyWithSummary(businessId, setting, chatId, telegramUserId, "month");
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
    await this.sendPersonal(setting, chatId, link ? text : "Link your ERP account first, then you can view attendance summaries.", true, mainMenuKeyboard(Boolean(link)));
  }

  private async replyWithSummary(businessId: string, setting: any, chatId: string, telegramUserId: string, range: "today" | "week" | "month") {
    const link = await db.TelegramAccountLink.findOne({ where: { businessId, telegramUserId, isActive: true } });
    if (!link) {
      await this.sendPersonal(setting, chatId, "This Telegram account is not linked yet. Tap Link account, then paste your one-time ERP code.", true, mainMenuKeyboard(false));
      return { ok: true };
    }
    const summary = await this.buildPersonalSummary(businessId, link.userId, range);
    await this.sendPersonal(setting, chatId, summary, true, mainMenuKeyboard(true));
    return { ok: true };
  }

  private async unlinkTelegramChat(businessId: string, setting: any, chatId: string, telegramUserId: string) {
    const link = await db.TelegramAccountLink.findOne({ where: { businessId, telegramUserId, isActive: true } });
    if (link) await link.update({ isActive: false, unlinkedAt: new Date() });
    await this.sendPersonal(setting, chatId, "Telegram access has been disconnected.", true, mainMenuKeyboard(false));
    return { ok: true };
  }

  private async showReasonPicker(businessId: string, setting: any, chatId: string, telegramUserId: string, reasonType: "late" | "unavailable") {
    const link = await db.TelegramAccountLink.findOne({ where: { businessId, telegramUserId, isActive: true } });
    if (!link) {
      await this.sendPersonal(setting, chatId, "Link your ERP account before adding attendance reasons.", true, mainMenuKeyboard(false));
      return { ok: true };
    }
    const reasons = await db.AttendanceLateReason.findAll({ where: { businessId, isActive: true }, order: [["name", "ASC"]] });
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
    const reason = await db.AttendanceLateReason.findOne({ where: { id: reasonId, businessId, isActive: true } });
    if (!reason) {
      await this.sendPersonal(setting, chatId, "That reason is no longer available.", true, mainMenuKeyboard(true));
      return { ok: true };
    }
    if (reason.requiresComment) {
      await link.update({ pendingAction: { kind: "daily_reason_comment", reasonType, reasonId } });
      await this.sendPersonal(setting, chatId, `Add a short comment for "${reason.name}".`, false);
      return { ok: true };
    }
    await this.createDailyReason(businessId, link.userId, reasonType, reasonId, null, "telegram");
    await this.sendPersonal(setting, chatId, `${reasonType === "late" ? "Late" : "Unavailability"} reason added for today: ${reason.name}`, true, mainMenuKeyboard(true));
    return { ok: true };
  }

  private async saveDailyReasonFromPending(businessId: string, setting: any, chatId: string, link: any, comment: string) {
    const pending = link.pendingAction;
    const reason = await db.AttendanceLateReason.findOne({ where: { id: pending.reasonId, businessId, isActive: true } });
    if (!reason) {
      await link.update({ pendingAction: null });
      await this.sendPersonal(setting, chatId, "That reason is no longer available.", true, mainMenuKeyboard(true));
      return;
    }
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

  async pollPersonalBotUpdates() {
    const settings = await db.TelegramBotSetting.findAll({ where: { botType: "PERSONAL_SUMMARY", enabled: true } });
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
          await this.handleWebhook(setting.businessId, update);
        } catch (err: any) {
          console.error(`[TelegramPersonalBot] update ${update.update_id} failed for ${setting.businessId}: ${err.message}`);
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
    const row = await db.TelegramLinkCode.findOne({
      where: { businessId, codeHash: hashCode(code), usedAt: null, expiresAt: { [Op.gt]: new Date() } }
    });
    if (!row) {
      await this.sendPersonal(setting, chatId, "That link code is invalid or expired. Generate a new code in ERP.");
      return { ok: true };
    }
    await db.sequelize.transaction(async (transaction: any) => {
      await row.update({ usedAt: new Date() }, { transaction });
      await db.TelegramAccountLink.upsert(
        { businessId, userId: row.userId, telegramUserId, telegramChatId: chatId, telegramUsername: username, isActive: true, linkedAt: new Date(), unlinkedAt: null },
        { transaction }
      );
    });
    await this.sendPersonal(setting, chatId, "Your Telegram account is linked.", true, mainMenuKeyboard(true));
    return { ok: true };
  }

  async notifyLateReason(businessId: string, employeeId: string, attendanceEventId: string, explanationId: string) {
    const setting = await db.TelegramBotSetting.findOne({ where: { businessId, botType: "LATE_REASON", enabled: true } });
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
      `Department: ${record?.department?.name || "N/A"}`
    ].join("\n");
    await this.sendAndLog(setting, "late_reason_submitted", { chat_id: setting.chatId, text: msg });
  }

  async runDailySummarySweep(now = new Date()) {
    const settings = await db.TelegramBotSetting.findAll({ where: { botType: "ATTENDANCE_SUMMARY", enabled: true } });
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
      await this.sendDailySummaryCsv(setting.businessId, ymd, setting);
      await setting.update({ lastSentForDate: ymd, lastSentAt: new Date() });
    }
  }

  private async sendDailySummaryCsv(businessId: string, dateYmd: string, setting: any, isTest = false) {
    const report = await this.hr.report(businessId, { startDate: dateYmd, endDate: dateYmd, sortBy: "name", sortOrder: "asc" });
    const headers = ["date", "employeeName", "department", "checkIn", "checkOut", "workedHours", "status", "late", "lateMinutes", "mode", "remoteOrOffice", "lateReason", "lateExplanation"];
    const rows = report.rows.map((r: any) => ({
      date: r.date,
      employeeName: r.employeeName,
      department: r.department?.name || "",
      checkIn: r.checkInAtUtc || "",
      checkOut: r.checkOutAtUtc || "",
      workedHours: (Number(r.totalWorkedMinutes || 0) / 60).toFixed(2),
      status: r.currentStatus,
      late: r.isLate ? "Yes" : "No",
      lateMinutes: r.lateByMinutes || 0,
      mode: r.currentStatus === "REMOTE" ? "Remote" : "Office",
      remoteOrOffice: r.currentStatus === "REMOTE" ? "Remote" : "Office",
      lateReason: r.lateReasonName || "",
      lateExplanation: r.lateExplanation || ""
    }));
    const csv = toCsv(rows, headers);
    await this.sendAndLog(setting, "daily_attendance_summary_csv", {
      chat_id: setting.chatId,
      caption: `${isTest ? "Test: " : ""}Attendance summary for ${dateYmd}`,
      document: `${isTest ? "test-" : ""}attendance-summary-${dateYmd}.csv`
    }, csv);
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
    const report = await this.hr.report(businessId, { startDate: startYmd, endDate: today, employeeId: userId, sortBy: "date", sortOrder: "asc" });
    const user = await db.User.findByPk(userId);
    const total = report.rows.reduce((sum: number, r: any) => sum + Number(r.totalWorkedMinutes || 0), 0);
    const late = report.rows.filter((r: any) => r.isLate).length;
    const absence = report.rows.filter((r: any) => r.currentStatus === "MISSED").length;
    const remote = report.rows.filter((r: any) => r.currentStatus === "REMOTE").length;
    const office = report.rows.length - remote - absence;
    const checkins = report.rows.map((r: any) => `${r.date}: ${r.checkInAtUtc ? localTimeHhmm(new Date(r.checkInAtUtc), tz) : "--"} - ${r.checkOutAtUtc ? localTimeHhmm(new Date(r.checkOutAtUtc), tz) : "--"}`).join("\n");
    return [
      `${user?.fullName || "Your"} attendance summary`,
      `Range: ${startYmd} to ${today}`,
      `Total worked: ${minutesLabel(total)}`,
      `Late count: ${late}`,
      `Absence count: ${absence}`,
      `Remote / office: ${remote} / ${office}`,
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
    const log = await db.TelegramNotificationLog.create({ businessId: setting.businessId, botType: setting.botType, recipientChatId: payload.chat_id, eventType, status: "pending", payload });
    try {
      if (csv) {
        await telegramMultipart(setting.botToken, "sendDocument", { chat_id: String(payload.chat_id), caption: payload.caption || "" }, { name: payload.document, content: csv, type: "text/csv" });
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
