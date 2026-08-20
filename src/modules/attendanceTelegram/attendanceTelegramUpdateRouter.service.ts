import { db } from "../../models";
import { AttendanceTelegramService } from "./attendanceTelegram.service";
import { AttendanceTelegramFlowService } from "./attendanceTelegramFlow.service";

const MAIN_BOT_TYPE = "PERSONAL_SUMMARY";

function parseCoordinates(text: string) {
  const match = String(text || "").trim().match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function normalizePastedLocation(update: any) {
  const message = update?.message || update?.edited_message;
  if (!message || message.location || message.venue?.location || !message.text) return update;
  const coordinates = parseCoordinates(message.text);
  if (!coordinates) return update;

  if (update.message) {
    return { ...update, message: { ...message, location: coordinates } };
  }
  if (update.edited_message) {
    return { ...update, edited_message: { ...message, location: coordinates } };
  }
  return update;
}

async function telegramGetUpdates(botToken: string, offset?: number | null) {
  const query = new URLSearchParams({
    timeout: "0",
    allowed_updates: JSON.stringify(["message", "edited_message", "callback_query"]),
  });
  if (offset) query.set("offset", String(offset));

  const response = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?${query.toString()}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) throw new Error(data.description || "Telegram getUpdates failed");
  return Array.isArray(data.result) ? data.result : [];
}

export class AttendanceTelegramUpdateRouterService {
  private flow = new AttendanceTelegramFlowService();
  private legacy = new AttendanceTelegramService();

  async handleUpdate(businessId: string, update: any) {
    const normalizedUpdate = normalizePastedLocation(update);
    const result = await this.flow.handleUpdate(businessId, normalizedUpdate);
    if (result.handled) return { ok: true };
    return this.legacy.handleWebhook(businessId, update);
  }

  async pollPersonalBotUpdates() {
    const settings = await db.TelegramBotSetting.findAll({
      where: { botType: MAIN_BOT_TYPE, enabled: true },
    });

    console.log(`[TelegramPersonalBot] enabled personal bot configs: ${settings.length}`);

    for (const setting of settings) {
      if (!setting.botToken) {
        console.log(`[TelegramPersonalBot] skipped ${setting.businessId}: missing token`);
        continue;
      }

      let updates: any[] = [];
      try {
        updates = await telegramGetUpdates(setting.botToken, setting.updateOffset);
      } catch (error: any) {
        console.error(`[TelegramPersonalBot] getUpdates failed for ${setting.businessId}: ${error.message}`);
        continue;
      }

      if (!updates.length) continue;
      console.log(`[TelegramPersonalBot] processing ${updates.length} update(s) for ${setting.businessId}`);

      let nextOffset = Number(setting.updateOffset || 0);
      for (const update of updates) {
        const updateId = Number(update.update_id);
        if (Number.isFinite(updateId)) nextOffset = Math.max(nextOffset, updateId + 1);

        try {
          await this.handleUpdate(setting.businessId, update);
        } catch (error: any) {
          const details = Array.isArray(error?.errors)
            ? ` ${error.errors.map((item: any) => `${item.path || "field"}: ${item.message}`).join("; ")}`
            : "";
          console.error(`[TelegramPersonalBot] update ${update.update_id} failed for ${setting.businessId}: ${error.message}${details}`);
        }
      }

      await setting.update({ updateOffset: nextOffset });
    }
  }
}
