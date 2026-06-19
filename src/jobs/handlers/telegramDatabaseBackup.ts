import { JobDefinition } from "../runner";
import { AttendanceTelegramService } from "../../modules/attendanceTelegram/attendanceTelegram.service";

export const telegramDatabaseBackup: JobDefinition = {
  name: "TelegramDatabaseBackup",
  type: "telegram",
  cronExpression: "*/5 * * * *",
  handler: async () => {
    await new AttendanceTelegramService().runDatabaseBackupSweep();
  }
};
