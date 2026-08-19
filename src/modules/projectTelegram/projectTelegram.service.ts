import { Op, Transaction } from "sequelize";
import { db } from "../../models";
import { TelegramDepartmentChannel, TelegramDepartmentConfig, TelegramTaskSyncLog } from "./projectTelegram.models";
import { startOfBusinessDayUtc, endOfBusinessDayUtc } from "../../utils/timezone";

const BOT_TYPE = "PROJECT_TASKS";
const DEFAULT_TIMEZONE = "Africa/Addis_Ababa";
const MANUAL_SYNC_TYPE = "DAILY_TASK_PUBLICATION";
const CHECKOUT_SYNC_TYPE = "EMPLOYEE_CHECKOUT";
const TELEGRAM_SAFE_MESSAGE_LENGTH = 3800;
const ACTIVE_TASK_EXCLUDED_STATUSES = ["DONE", "CANCELLED", "COMPLETED", "done", "cancelled", "completed"];
const DONE_STATUSES = ["DONE", "COMPLETED", "done", "completed"];

type DepartmentChannelInput = {
  chatId: string;
  label?: string | null;
  enabled?: boolean;
};

type TaskMessageChunk = {
  text: string;
  taskIds: string[];
};

function maskToken(token?: string | null) {
  if (!token) return null;
  if (token.length <= 12) return "••••••••";
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function localDateYmd(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function displayDate(dateYmd: string) {
  const [year, month, day] = dateYmd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function statusLabel(value: unknown) {
  const status = String(value || "TODO").toUpperCase();
  const labels: Record<string, string> = {
    BACKLOG: "Backlog",
    TODO: "To Do",
    IN_PROGRESS: "In Progress",
    IN_REVIEW: "In Review",
    BLOCKED: "Blocked",
    DONE: "Done",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  };
  return labels[status] || status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function priorityLabel(value: unknown) {
  const priority = String(value || "MEDIUM").toUpperCase();
  const labels: Record<string, string> = {
    LOW: "Low",
    MEDIUM: "Medium",
    HIGH: "High",
    URGENT: "Urgent",
    CRITICAL: "Critical",
  };
  return labels[priority] || priority.replace(/_/g, " ");
}

function priorityEmoji(value: unknown) {
  const priority = String(value || "MEDIUM").toUpperCase();
  if (priority === "CRITICAL" || priority === "URGENT" || priority === "HIGH") return "🔴";
  if (priority === "MEDIUM") return "🟡";
  return "🟢";
}

function taskProjectTitle(task: any) {
  return task.Project?.title || task.project?.title || "Project";
}

function employeeIdentity(employee: any) {
  return {
    name: employee?.user?.fullName || "Employee",
    departmentName: employee?.department?.name || "No department",
    positionTitle: employee?.position?.title || "No position",
  };
}

function taskBlock(task: any, checkout = false) {
  const title = escapeHtml(task.title || "Untitled task");
  const project = escapeHtml(taskProjectTitle(task));
  const due = task.dueDate ? ` · Due ${escapeHtml(String(task.dueDate))}` : "";
  if (checkout) {
    return `✅ <b>${title}</b>\n📁 ${project}\nStatus: <b>${escapeHtml(statusLabel(task.status))}</b>`;
  }
  return `${priorityEmoji(task.priority)} <b>${title}</b>\n📁 ${project}\nStatus: <b>${escapeHtml(statusLabel(task.status))}</b> · Priority: ${escapeHtml(priorityLabel(task.priority))}${due}`;
}

function buildTaskChunks(employee: any, tasks: any[], dateYmd: string, checkout: boolean): TaskMessageChunk[] {
  const identity = employeeIdentity(employee);
  const header = checkout
    ? `🏁 <b>End of Day — ${escapeHtml(identity.name)}</b>\n🏢 ${escapeHtml(identity.departmentName)} · ${escapeHtml(identity.positionTitle)}`
    : `📋 <b>Today's Tasks</b>\n👤 <b>${escapeHtml(identity.name)}</b>\n🏢 ${escapeHtml(identity.departmentName)} · ${escapeHtml(identity.positionTitle)}`;

  if (!tasks.length) {
    return [{
      text: `${header}\n\nNo tasks were completed today.\n\n<b>Completed today: 0</b> · ${escapeHtml(displayDate(dateYmd))}`,
      taskIds: [],
    }];
  }

  const footer = checkout
    ? `\n\n<b>Completed today: ${tasks.length}</b> · ${escapeHtml(displayDate(dateYmd))}`
    : `\n\n<b>${tasks.length} task${tasks.length === 1 ? "" : "s"}</b> · ${escapeHtml(displayDate(dateYmd))}`;
  const chunks: TaskMessageChunk[] = [];
  let bodyBlocks: string[] = [];
  let taskIds: string[] = [];

  const flush = () => {
    if (!bodyBlocks.length) return;
    chunks.push({ text: `${header}\n\n${bodyBlocks.join("\n\n")}${footer}`, taskIds: [...taskIds] });
    bodyBlocks = [];
    taskIds = [];
  };

  for (const task of tasks) {
    const block = taskBlock(task, checkout);
    const candidate = `${header}\n\n${[...bodyBlocks, block].join("\n\n")}${footer}`;
    if (candidate.length > TELEGRAM_SAFE_MESSAGE_LENGTH && bodyBlocks.length) flush();
    bodyBlocks.push(block);
    taskIds.push(String(task.id));
  }
  flush();
  return chunks;
}

async function telegramRequest(botToken: string, method: string, body: any) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw Object.assign(new Error(data.description || `Telegram ${method} failed`), { statusCode: 502 });
  }
  return data;
}

export class ProjectTelegramService {
  private async getTimezone(businessId: string) {
    const attendanceSettings = await db.BusinessAttendanceSettings.findOne({
      where: { businessId },
      attributes: ["timezone"],
    });
    return attendanceSettings?.timezone || DEFAULT_TIMEZONE;
  }

  private async getBotSetting(businessId: string, requireEnabled = true) {
    const setting = await db.TelegramBotSetting.findOne({ where: { businessId, botType: BOT_TYPE } });
    if (!setting?.botToken) throw Object.assign(new Error("Telegram task bot token is not configured"), { statusCode: 400 });
    if (requireEnabled && !setting.enabled) throw Object.assign(new Error("Telegram task sync is disabled"), { statusCode: 400 });
    return setting;
  }

  private activeChannelsForDepartment(businessId: string, departmentId: string) {
    return TelegramDepartmentChannel.findAll({
      where: { businessId, departmentId, enabled: true },
      order: [["createdAt", "ASC"]],
    });
  }

  async getSettings(businessId: string) {
    const [botSetting, departments, configs, channels] = await Promise.all([
      db.TelegramBotSetting.findOne({ where: { businessId, botType: BOT_TYPE } }),
      db.Department.findAll({ where: { businessId }, order: [["name", "ASC"]] }),
      TelegramDepartmentConfig.findAll({ where: { businessId } }),
      TelegramDepartmentChannel.findAll({ where: { businessId }, order: [["createdAt", "ASC"]] }),
    ]);

    const configByDepartment = new Map(configs.map((config: any) => [String(config.departmentId), config]));
    const channelsByDepartment = new Map<string, any[]>();
    for (const channel of channels) {
      const key = String(channel.departmentId);
      const rows = channelsByDepartment.get(key) || [];
      rows.push(channel);
      channelsByDepartment.set(key, rows);
    }

    return {
      bot: {
        enabled: Boolean(botSetting?.enabled),
        botTokenMasked: maskToken(botSetting?.botToken),
        configured: Boolean(botSetting?.botToken),
      },
      departments: departments.map((department: any) => {
        const config = configByDepartment.get(String(department.id));
        return {
          id: department.id,
          name: department.name,
          enabled: Boolean(config?.enabled),
          channels: (channelsByDepartment.get(String(department.id)) || []).map((channel: any) => ({
            id: channel.id,
            chatId: channel.chatId,
            label: channel.label || "",
            enabled: Boolean(channel.enabled),
          })),
        };
      }),
    };
  }

  async upsertBotSetting(businessId: string, payload: { enabled?: boolean; botToken?: string }) {
    const [setting] = await db.TelegramBotSetting.findOrCreate({
      where: { businessId, botType: BOT_TYPE },
      defaults: {
        businessId,
        botType: BOT_TYPE,
        enabled: false,
        timezone: DEFAULT_TIMEZONE,
        chatId: null,
        sendTime: null,
      },
    });

    const update: any = {};
    if (typeof payload.enabled === "boolean") update.enabled = payload.enabled;
    if (typeof payload.botToken === "string" && payload.botToken.trim()) update.botToken = payload.botToken.trim();
    await setting.update(update);
    return {
      enabled: Boolean(setting.enabled),
      botTokenMasked: maskToken(setting.botToken),
      configured: Boolean(setting.botToken),
    };
  }

  async upsertDepartment(
    businessId: string,
    departmentId: string,
    payload: { enabled?: boolean; channels?: DepartmentChannelInput[] },
  ) {
    const department = await db.Department.findOne({ where: { id: departmentId, businessId } });
    if (!department) throw Object.assign(new Error("Department not found"), { statusCode: 404 });

    const incoming = Array.isArray(payload.channels) ? payload.channels : [];
    if (incoming.length > 25) throw Object.assign(new Error("A department can have at most 25 Telegram groups"), { statusCode: 400 });

    const deduped = new Map<string, DepartmentChannelInput>();
    for (const channel of incoming) {
      const chatId = String(channel?.chatId || "").trim();
      if (!chatId) continue;
      if (chatId.length > 120) throw Object.assign(new Error("Telegram Chat ID is too long"), { statusCode: 400 });
      deduped.set(chatId, {
        chatId,
        label: String(channel?.label || "").trim().slice(0, 160) || null,
        enabled: channel?.enabled !== false,
      });
    }

    await db.sequelize.transaction(async (transaction: Transaction) => {
      const [config] = await TelegramDepartmentConfig.findOrCreate({
        where: { businessId, departmentId },
        defaults: { businessId, departmentId, enabled: false },
        transaction,
      });
      if (typeof payload.enabled === "boolean") await config.update({ enabled: payload.enabled }, { transaction });

      await TelegramDepartmentChannel.destroy({ where: { businessId, departmentId }, transaction });
      if (deduped.size) {
        await TelegramDepartmentChannel.bulkCreate(
          Array.from(deduped.values()).map((channel) => ({ businessId, departmentId, ...channel })),
          { transaction },
        );
      }
    });

    return this.getSettings(businessId);
  }

  async testConnection(businessId: string) {
    const setting = await this.getBotSetting(businessId, false);
    const response = await telegramRequest(setting.botToken, "getMe", {});
    return {
      connected: true,
      username: response?.result?.username || null,
      displayName: response?.result?.first_name || null,
    };
  }

  async sendTestMessage(businessId: string, departmentId: string) {
    const setting = await this.getBotSetting(businessId, true);
    const config = await TelegramDepartmentConfig.findOne({ where: { businessId, departmentId } });
    if (!config?.enabled) throw Object.assign(new Error("Telegram sync is disabled for this department"), { statusCode: 400 });
    const department = await db.Department.findOne({ where: { id: departmentId, businessId } });
    if (!department) throw Object.assign(new Error("Department not found"), { statusCode: 404 });
    const channels = await this.activeChannelsForDepartment(businessId, departmentId);
    if (!channels.length) throw Object.assign(new Error("No active Telegram groups are configured for this department"), { statusCode: 400 });

    for (const channel of channels) {
      await telegramRequest(setting.botToken, "sendMessage", {
        chat_id: channel.chatId,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        text: `🧪 <b>Blih Telegram Task Sync</b>\n\nDepartment: <b>${escapeHtml(department.name)}</b>\nConnection and group routing are working.`,
      });
    }
    return { sent: true, groups: channels.length };
  }

  async sendTodayTasks(businessId: string) {
    const setting = await this.getBotSetting(businessId, true);
    const timezone = await this.getTimezone(businessId);
    const now = new Date();
    const syncDate = localDateYmd(now, timezone);
    const startUtc = startOfBusinessDayUtc(now, timezone);
    const endUtc = endOfBusinessDayUtc(now, timezone);

    const tasks = await db.ProjectTask.findAll({
      where: {
        businessId,
        assigneeEmployeeId: { [Op.ne]: null },
        createdAt: { [Op.gte]: startUtc, [Op.lt]: endUtc },
        status: { [Op.notIn]: ACTIVE_TASK_EXCLUDED_STATUSES },
      },
      include: [
        { model: db.Project, attributes: ["id", "title", "code"] },
        {
          model: db.EmployeeRecord,
          as: "employeeAssignee",
          required: true,
          include: [
            { model: db.User, as: "user", attributes: ["id", "fullName"] },
            { model: db.Department, as: "department", attributes: ["id", "name"] },
            { model: db.Position, as: "position", attributes: ["id", "title"] },
          ],
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    const configs = await TelegramDepartmentConfig.findAll({ where: { businessId, enabled: true } });
    const enabledDepartments = new Set(configs.map((config: any) => String(config.departmentId)));
    const channels = await TelegramDepartmentChannel.findAll({ where: { businessId, enabled: true } });
    const channelsByDepartment = new Map<string, any[]>();
    for (const channel of channels) {
      const key = String(channel.departmentId);
      const rows = channelsByDepartment.get(key) || [];
      rows.push(channel);
      channelsByDepartment.set(key, rows);
    }

    const groups = new Map<string, { employee: any; departmentId: string; tasks: any[] }>();
    let ineligibleTasks = 0;
    for (const task of tasks) {
      const employee = task.employeeAssignee;
      const departmentId = employee?.departmentId ? String(employee.departmentId) : "";
      if (!departmentId || !enabledDepartments.has(departmentId) || !(channelsByDepartment.get(departmentId)?.length)) {
        ineligibleTasks += 1;
        continue;
      }
      const key = `${departmentId}:${employee.id}`;
      const group = groups.get(key) || { employee, departmentId, tasks: [] };
      group.tasks.push(task);
      groups.set(key, group);
    }

    let sentMessages = 0;
    let sentTaskDeliveries = 0;
    const sentTaskIds = new Set<string>();
    let skippedAlreadySent = 0;
    const errors: Array<{ departmentId: string; employeeId: string; chatId: string; message: string }> = [];

    for (const group of groups.values()) {
      const departmentChannels = channelsByDepartment.get(group.departmentId) || [];
      for (const channel of departmentChannels) {
        const candidateTasks: any[] = [];
        for (const task of group.tasks) {
          const dedupeKey = `${MANUAL_SYNC_TYPE}:${syncDate}:${channel.chatId}:${task.id}`;
          const [, created] = await TelegramTaskSyncLog.findOrCreate({
            where: { businessId, dedupeKey },
            defaults: {
              businessId,
              departmentId: group.departmentId,
              employeeId: group.employee.id,
              taskId: task.id,
              chatId: channel.chatId,
              syncDate,
              syncType: MANUAL_SYNC_TYPE,
              dedupeKey,
              payload: { source: "manual", state: "reserved" },
              sentAt: new Date(),
            },
          });
          if (!created) {
            skippedAlreadySent += 1;
          } else {
            candidateTasks.push(task);
          }
        }
        if (!candidateTasks.length) continue;

        const chunks = buildTaskChunks(group.employee, candidateTasks, syncDate, false);
        for (const chunk of chunks) {
          const dedupeKeys = chunk.taskIds.map((taskId) => `${MANUAL_SYNC_TYPE}:${syncDate}:${channel.chatId}:${taskId}`);
          try {
            await telegramRequest(setting.botToken, "sendMessage", {
              chat_id: channel.chatId,
              parse_mode: "HTML",
              disable_web_page_preview: true,
              text: chunk.text,
            });
            await TelegramTaskSyncLog.update(
              { payload: { taskIds: chunk.taskIds, source: "manual", state: "sent" }, sentAt: new Date() },
              { where: { businessId, dedupeKey: { [Op.in]: dedupeKeys } } },
            );
            sentMessages += 1;
            sentTaskDeliveries += chunk.taskIds.length;
            chunk.taskIds.forEach((taskId) => sentTaskIds.add(taskId));
          } catch (error: any) {
            await TelegramTaskSyncLog.destroy({ where: { businessId, dedupeKey: { [Op.in]: dedupeKeys } } });
            errors.push({
              departmentId: group.departmentId,
              employeeId: String(group.employee.id),
              chatId: String(channel.chatId),
              message: error?.message || "Telegram send failed",
            });
          }
        }
      }
    }

    return {
      syncDate,
      eligibleTasks: tasks.length,
      sentTasks: sentTaskIds.size,
      sentTaskDeliveries,
      sentMessages,
      skippedAlreadySent,
      skippedNotConfigured: ineligibleTasks,
      errors,
    };
  }

  async sendCheckoutSummary(businessId: string, userId: string) {
    const setting = await db.TelegramBotSetting.findOne({ where: { businessId, botType: BOT_TYPE, enabled: true } });
    if (!setting?.botToken) return { sent: false, reason: "bot_not_configured" };

    const employee = await db.EmployeeRecord.findOne({
      where: { businessId, userId },
      include: [
        { model: db.User, as: "user", attributes: ["id", "fullName"] },
        { model: db.Department, as: "department", attributes: ["id", "name"] },
        { model: db.Position, as: "position", attributes: ["id", "title"] },
      ],
    });
    if (!employee?.departmentId) return { sent: false, reason: "employee_department_missing" };

    const departmentId = String(employee.departmentId);
    const config = await TelegramDepartmentConfig.findOne({ where: { businessId, departmentId, enabled: true } });
    if (!config) return { sent: false, reason: "department_disabled" };
    const channels = await this.activeChannelsForDepartment(businessId, departmentId);
    if (!channels.length) return { sent: false, reason: "department_groups_missing" };

    const timezone = await this.getTimezone(businessId);
    const now = new Date();
    const syncDate = localDateYmd(now, timezone);
    const startUtc = startOfBusinessDayUtc(now, timezone);
    const endUtc = endOfBusinessDayUtc(now, timezone);
    const tasks = await db.ProjectTask.findAll({
      where: {
        businessId,
        assigneeEmployeeId: employee.id,
        createdAt: { [Op.gte]: startUtc, [Op.lt]: endUtc },
        status: { [Op.in]: DONE_STATUSES },
      },
      include: [{ model: db.Project, attributes: ["id", "title", "code"] }],
      order: [["createdAt", "ASC"]],
    });
    const chunks = buildTaskChunks(employee, tasks, syncDate, true);

    let sentMessages = 0;
    const errors: Array<{ chatId: string; message: string }> = [];
    for (const channel of channels) {
      for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        const dedupeKey = `${CHECKOUT_SYNC_TYPE}:${syncDate}:${channel.chatId}:${employee.id}:PART:${index}`;
        const [log, created] = await TelegramTaskSyncLog.findOrCreate({
          where: { businessId, dedupeKey },
          defaults: {
            businessId,
            departmentId,
            employeeId: employee.id,
            taskId: null,
            chatId: channel.chatId,
            syncDate,
            syncType: CHECKOUT_SYNC_TYPE,
            dedupeKey,
            payload: { taskIds: chunk.taskIds, source: "attendance_checkout", part: index, state: "reserved" },
            sentAt: new Date(),
          },
        });
        if (!created) continue;
        try {
          await telegramRequest(setting.botToken, "sendMessage", {
            chat_id: channel.chatId,
            parse_mode: "HTML",
            disable_web_page_preview: true,
            text: chunk.text,
          });
          await log.update({
            payload: { taskIds: chunk.taskIds, source: "attendance_checkout", part: index, state: "sent" },
            sentAt: new Date(),
          });
          sentMessages += 1;
        } catch (error: any) {
          await log.destroy();
          errors.push({ chatId: String(channel.chatId), message: error?.message || "Telegram send failed" });
        }
      }
    }

    return { sent: sentMessages > 0, sentMessages, completedTasks: tasks.length, errors };
  }
}
