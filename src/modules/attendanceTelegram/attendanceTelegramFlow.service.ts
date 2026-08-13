import crypto from "crypto";
import { Op } from "sequelize";
import { db } from "../../models";
import { AttendanceMeService } from "../attendanceMe/attendanceMe.service";

type AttendanceEventType = "CHECK_IN" | "LUNCH_OUT" | "LUNCH_IN" | "CHECK_OUT";

const MAIN_BOT_TYPE = "PERSONAL_SUMMARY";
const LEGACY_BOT_TYPE = "ATTENDANCE_SUMMARY";
const LINK_TTL_MS = 10 * 60 * 1000;
const PENDING_LOCATION_TTL_MS = 10 * 60 * 1000;

const ACTION_LABEL: Record<AttendanceEventType, string> = {
  CHECK_IN: "Check In",
  LUNCH_OUT: "Lunch Out",
  LUNCH_IN: "Return",
  CHECK_OUT: "Check Out",
};

const ACTION_CALLBACK: Record<AttendanceEventType, string> = {
  CHECK_IN: "attendance:check_in",
  LUNCH_OUT: "attendance:lunch_out",
  LUNCH_IN: "attendance:lunch_in",
  CHECK_OUT: "attendance:check_out",
};

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

function normalizeCode(value: string | undefined | null) {
  const code = String(value || "").replace(/\s+/g, "").toUpperCase();
  return /^[A-F0-9]{6}$/.test(code) ? code : null;
}

function minutesLabel(minutes: number) {
  const value = Math.max(0, Math.round(Number(minutes || 0)));
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  return hours ? `${hours}h ${mins}m` : `${mins}m`;
}

function locationKeyboard(label: string) {
  return {
    keyboard: [[{ text: "Share phone location", request_location: true }], ["Cancel"]],
    resize_keyboard: true,
    one_time_keyboard: false,
    input_field_placeholder: `${label}: share your current location`,
  };
}

function removeReplyKeyboard() {
  return { remove_keyboard: true };
}

async function telegramRequest(botToken: string, method: string, body: any) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.description || `Telegram ${method} failed`);
  return data;
}

export class AttendanceTelegramFlowService {
  private attendance = new AttendanceMeService();

  private async getMainSetting(businessId: string, enabledOnly = true) {
    const whereEnabled = enabledOnly ? { enabled: true } : {};
    const main = await db.TelegramBotSetting.findOne({
      where: { businessId, botType: MAIN_BOT_TYPE, ...whereEnabled },
    });
    if (main?.botToken) return main;
    return db.TelegramBotSetting.findOne({
      where: { businessId, botType: LEGACY_BOT_TYPE, ...whereEnabled },
    });
  }

  private async botIdentity(businessId: string) {
    const setting = await this.getMainSetting(businessId, false);
    if (!setting?.botToken) return { botUsername: null, botUrl: null };
    try {
      const response = await telegramRequest(setting.botToken, "getMe", {});
      const botUsername = response?.result?.username ? String(response.result.username) : null;
      return {
        botUsername,
        botUrl: botUsername ? `https://t.me/${botUsername}` : null,
      };
    } catch {
      return { botUsername: null, botUrl: null };
    }
  }

  async generateLinkCode(userId: string, businessId: string) {
    const code = crypto.randomBytes(3).toString("hex").toUpperCase();
    const expiresAt = new Date(Date.now() + LINK_TTL_MS);

    await db.TelegramLinkCode.update(
      { usedAt: new Date() },
      { where: { businessId, userId, usedAt: null } },
    );
    await db.TelegramLinkCode.create({
      businessId,
      userId,
      codeHash: hashCode(code),
      expiresAt,
    });

    const identity = await this.botIdentity(businessId);
    return {
      code,
      expiresAt: expiresAt.toISOString(),
      ...identity,
      deepLink: identity.botUsername ? `https://t.me/${identity.botUsername}?start=${code}` : null,
    };
  }

  async getMyStatus(userId: string, businessId: string) {
    const link = await db.TelegramAccountLink.findOne({
      where: { businessId, userId, isActive: true },
    });
    const identity = await this.botIdentity(businessId);
    return {
      linked: Boolean(link),
      telegramUsername: link?.telegramUsername || null,
      linkedAt: link?.linkedAt || null,
      ...identity,
    };
  }

  private async send(setting: any, chatId: string, text: string, replyMarkup?: any, eventType = "personal_flow_reply") {
    const payload: any = { chat_id: chatId, text };
    if (replyMarkup) payload.reply_markup = replyMarkup;

    const log = db.TelegramNotificationLog?.create
      ? await db.TelegramNotificationLog.create({
          businessId: setting.businessId,
          botType: setting.botType,
          recipientChatId: chatId,
          eventType,
          status: "pending",
          payload,
        })
      : null;

    try {
      const response = await telegramRequest(setting.botToken, "sendMessage", payload);
      if (log) await log.update({ status: "sent", sentAt: new Date() });
      return response;
    } catch (error: any) {
      if (log) await log.update({ status: "failed", errorMessage: error?.message || "Telegram send failed" });
      throw error;
    }
  }

  private async linkForTelegram(businessId: string, telegramUserId: string) {
    return db.TelegramAccountLink.findOne({
      where: { businessId, telegramUserId, isActive: true },
    });
  }

  private menuKeyboard(nextAllowed: AttendanceEventType[]) {
    const actionButtons = nextAllowed.map((type) => ({
      text: ACTION_LABEL[type],
      callback_data: ACTION_CALLBACK[type],
    }));
    const rows: any[][] = [];
    for (let index = 0; index < actionButtons.length; index += 2) rows.push(actionButtons.slice(index, index + 2));
    rows.push([{ text: "My Summary", callback_data: "summary:today" }]);
    rows.push([
      { text: "Late reason", callback_data: "reason:late" },
      { text: "Unavailable", callback_data: "reason:unavailable" },
    ]);
    rows.push([{ text: "Unlink", callback_data: "account:unlink" }]);
    return { inline_keyboard: rows };
  }

  private summaryText(summary: any, fullName?: string | null) {
    const calculation = summary?.calculation || {};
    const day = summary?.day || {};
    const status = String(calculation.currentStatus || "NOT_STARTED");
    const worked = minutesLabel(calculation.totalWorkedMinutes || 0);
    const remaining = minutesLabel(Math.max(0, Number(summary?.settings?.expectedDailyMinutes || 480) - Number(calculation.totalWorkedMinutes || 0)));

    let headline = "Ready to check in";
    if (status === "ON_BREAK") headline = "On lunch break";
    else if (status === "IN_PROGRESS") headline = "Working";
    else if (day?.checkOutAtUtc) headline = "Workday complete";
    else if (summary?.disabledReason) headline = String(summary.disabledReason);

    const lines = [fullName ? `Blih Attendance · ${fullName}` : "Blih Attendance", headline];
    if (!summary?.attendanceExemption) {
      lines.push(`Worked: ${worked}`);
      lines.push(`Remaining: ${remaining}`);
    }
    if (summary?.cooldown?.active) lines.push(`Next action available in ${summary.cooldown.remainingMinutes} min`);
    return lines.join("\n");
  }

  private async sendMenu(setting: any, businessId: string, chatId: string, telegramUserId: string, prefix?: string) {
    const link = await this.linkForTelegram(businessId, telegramUserId);
    if (!link) {
      await this.send(
        setting,
        chatId,
        prefix || "Link Telegram from Blih ERP to use attendance actions.",
        { inline_keyboard: [[{ text: "Link account", callback_data: "account:link" }]] },
      );
      return;
    }

    const [summary, user] = await Promise.all([
      this.attendance.getTodaySummary(link.userId, businessId),
      db.User.findByPk(link.userId, { attributes: ["fullName"] }),
    ]);
    const nextAllowed = Array.isArray(summary.nextAllowed) ? summary.nextAllowed as AttendanceEventType[] : [];
    const text = [prefix, this.summaryText(summary, user?.fullName)].filter(Boolean).join("\n\n");
    await this.send(setting, chatId, text, this.menuKeyboard(nextAllowed));
  }

  private callbackType(data: string): AttendanceEventType | null {
    const entries = Object.entries(ACTION_CALLBACK) as Array<[AttendanceEventType, string]>;
    return entries.find(([, callback]) => callback === data)?.[0] || null;
  }

  private async requestLocation(setting: any, businessId: string, chatId: string, telegramUserId: string, type: AttendanceEventType) {
    const link = await this.linkForTelegram(businessId, telegramUserId);
    if (!link) {
      await this.sendMenu(setting, businessId, chatId, telegramUserId, "Link your ERP account first.");
      return;
    }

    const summary = await this.attendance.getTodaySummary(link.userId, businessId);
    const nextAllowed = Array.isArray(summary.nextAllowed) ? summary.nextAllowed as AttendanceEventType[] : [];
    if (!nextAllowed.includes(type)) {
      await this.sendMenu(setting, businessId, chatId, telegramUserId, "That action is not available right now.");
      return;
    }

    await link.update({
      pendingAction: {
        kind: "attendance_event_location",
        type,
        requestedAt: new Date().toISOString(),
      },
    });
    await this.send(
      setting,
      chatId,
      `${ACTION_LABEL[type]} needs your current location. Tap the button below.`,
      locationKeyboard(ACTION_LABEL[type]),
      "attendance_location_requested",
    );
  }

  private async handleLocation(setting: any, businessId: string, chatId: string, telegramUserId: string, location: any) {
    const link = await this.linkForTelegram(businessId, telegramUserId);
    if (!link) return false;
    const pending = link.pendingAction;
    if (pending?.kind !== "attendance_event_location") return false;

    const type = pending.type as AttendanceEventType;
    if (!Object.prototype.hasOwnProperty.call(ACTION_LABEL, type)) {
      await link.update({ pendingAction: null });
      return false;
    }

    const requestedAt = pending.requestedAt ? new Date(pending.requestedAt).getTime() : 0;
    if (requestedAt && Date.now() - requestedAt > PENDING_LOCATION_TTL_MS) {
      await link.update({ pendingAction: null });
      await this.send(setting, chatId, "That attendance request expired. Choose the action again.", removeReplyKeyboard());
      await this.sendMenu(setting, businessId, chatId, telegramUserId);
      return true;
    }

    try {
      const result = await this.attendance.createEvent(link.userId, businessId, {
        type,
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
      });
      await link.update({ pendingAction: null });
      const latest = result?.timeline?.[result.timeline.length - 1];
      const distance = latest?.distanceMeters != null ? ` · ${Math.round(Number(latest.distanceMeters))}m from workplace` : "";
      await this.send(setting, chatId, `✅ ${ACTION_LABEL[type]} recorded${distance}.`, removeReplyKeyboard(), "attendance_action_completed");
      await this.sendMenu(setting, businessId, chatId, telegramUserId);
    } catch (error: any) {
      await link.update({ pendingAction: null });
      await this.send(setting, chatId, `Could not record ${ACTION_LABEL[type]}: ${error?.message || "Attendance action failed"}`, removeReplyKeyboard(), "attendance_action_failed");
      await this.sendMenu(setting, businessId, chatId, telegramUserId);
    }
    return true;
  }

  private async linkTelegramUser(setting: any, businessId: string, chatId: string, telegramUserId: string, username: string | null, rawCode?: string | null) {
    const code = normalizeCode(rawCode);
    if (!code) {
      await this.send(setting, chatId, "Open Blih ERP → Attendance → Telegram attendance → Connect, then open Telegram from ERP.");
      return true;
    }

    const row = await db.TelegramLinkCode.findOne({
      where: {
        businessId,
        codeHash: hashCode(code),
        usedAt: null,
        expiresAt: { [Op.gt]: new Date() },
      },
    });
    if (!row) {
      await this.send(setting, chatId, "This link is invalid or expired. Generate a new Telegram link from Blih ERP.");
      return true;
    }

    await db.sequelize.transaction(async (transaction: any) => {
      await row.update({ usedAt: new Date() }, { transaction });
      const existing = await db.TelegramAccountLink.findAll({
        where: {
          businessId,
          [Op.or]: [{ userId: row.userId }, { telegramUserId }],
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const primary = existing[0] || null;
      const payload = {
        businessId,
        userId: row.userId,
        telegramUserId,
        telegramChatId: chatId,
        telegramUsername: username,
        pendingAction: null,
        isActive: true,
        linkedAt: new Date(),
        unlinkedAt: null,
      };
      if (primary) {
        for (const extra of existing.slice(1)) await extra.destroy({ transaction });
        await primary.update(payload, { transaction });
      } else {
        await db.TelegramAccountLink.create(payload, { transaction });
      }
    });

    await this.send(setting, chatId, "✅ Telegram is connected to your Blih ERP account.", removeReplyKeyboard(), "account_linked");
    await this.sendMenu(setting, businessId, chatId, telegramUserId);
    return true;
  }

  private async unlink(setting: any, businessId: string, chatId: string, telegramUserId: string) {
    const link = await this.linkForTelegram(businessId, telegramUserId);
    if (link) await link.update({ isActive: false, pendingAction: null, unlinkedAt: new Date() });
    await this.send(
      setting,
      chatId,
      "Telegram attendance has been disconnected from Blih ERP.",
      removeReplyKeyboard(),
      "account_unlinked",
    );
    return true;
  }

  async handleUpdate(businessId: string, update: any): Promise<{ handled: boolean }> {
    const setting = await this.getMainSetting(businessId, true);
    if (!setting?.botToken) return { handled: false };

    if (update?.callback_query) {
      const callback = update.callback_query;
      const chatId = String(callback.message?.chat?.id || callback.from?.id || "");
      if (!chatId || callback.message?.chat?.type && callback.message.chat.type !== "private") return { handled: false };
      const telegramUserId = String(callback.from?.id || "");
      const data = String(callback.data || "");
      const type = this.callbackType(data);

      if (type) {
        await telegramRequest(setting.botToken, "answerCallbackQuery", { callback_query_id: callback.id });
        await this.requestLocation(setting, businessId, chatId, telegramUserId, type);
        return { handled: true };
      }
      if (data === "menu" || data === "summary:today") {
        await telegramRequest(setting.botToken, "answerCallbackQuery", { callback_query_id: callback.id });
        await this.sendMenu(setting, businessId, chatId, telegramUserId);
        return { handled: true };
      }
      if (data === "account:unlink") {
        await telegramRequest(setting.botToken, "answerCallbackQuery", { callback_query_id: callback.id });
        await this.unlink(setting, businessId, chatId, telegramUserId);
        return { handled: true };
      }
      if (data === "account:link") {
        await telegramRequest(setting.botToken, "answerCallbackQuery", { callback_query_id: callback.id });
        await this.send(setting, chatId, "Open Blih ERP → Attendance → Telegram attendance → Connect. The Connect button opens Telegram with a secure one-time link.");
        return { handled: true };
      }
      return { handled: false };
    }

    const message = update?.message || update?.edited_message;
    if (!message?.from?.id || message.chat?.type && message.chat.type !== "private") return { handled: false };
    const chatId = String(message.chat.id);
    const telegramUserId = String(message.from.id);
    const username = message.from.username || null;

    if (message.location || message.venue?.location) {
      const handled = await this.handleLocation(setting, businessId, chatId, telegramUserId, message.location || message.venue.location);
      return { handled };
    }

    const text = String(message.text || "").trim();
    const [command, arg] = text.split(/\s+/, 2);

    if (command === "/start") {
      if (arg) await this.linkTelegramUser(setting, businessId, chatId, telegramUserId, username, arg);
      else await this.sendMenu(setting, businessId, chatId, telegramUserId);
      return { handled: true };
    }
    if (["Today", "/today", "My Summary"].includes(text)) {
      await this.sendMenu(setting, businessId, chatId, telegramUserId);
      return { handled: true };
    }
    if (["Unlink", "/unlink"].includes(text)) {
      await this.unlink(setting, businessId, chatId, telegramUserId);
      return { handled: true };
    }

    const directType = (Object.keys(ACTION_LABEL) as AttendanceEventType[]).find((type) => ACTION_LABEL[type].toLowerCase() === text.toLowerCase());
    if (directType) {
      await this.requestLocation(setting, businessId, chatId, telegramUserId, directType);
      return { handled: true };
    }

    const link = await this.linkForTelegram(businessId, telegramUserId);
    if (text === "Cancel" && link?.pendingAction?.kind === "attendance_event_location") {
      await link.update({ pendingAction: null });
      await this.send(setting, chatId, "Cancelled.", removeReplyKeyboard());
      await this.sendMenu(setting, businessId, chatId, telegramUserId);
      return { handled: true };
    }

    const code = normalizeCode(command === "/link" ? arg : text);
    if (code) {
      await this.linkTelegramUser(setting, businessId, chatId, telegramUserId, username, code);
      return { handled: true };
    }

    return { handled: false };
  }
}
