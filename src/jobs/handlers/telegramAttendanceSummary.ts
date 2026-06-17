import { JobDefinition } from "../runner";
import { AttendanceTelegramService } from "../../modules/attendanceTelegram/attendanceTelegram.service";

export const telegramAttendanceSummary: JobDefinition = {
  name: "TelegramAttendanceSummary",
  type: "telegram",
  cronExpression: "* * * * *",
  handler: async () => {
    console.log(`[TelegramAttendanceSummary] sweep started at ${new Date().toISOString()}`);
    await new AttendanceTelegramService().runDailySummarySweep();
    console.log(`[TelegramAttendanceSummary] sweep finished at ${new Date().toISOString()}`);
  }
};
