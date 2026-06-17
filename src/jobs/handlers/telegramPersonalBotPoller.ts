import { JobDefinition } from "../runner";
import { AttendanceTelegramService } from "../../modules/attendanceTelegram/attendanceTelegram.service";

export const telegramPersonalBotPoller: JobDefinition = {
  name: "TelegramPersonalBotPoller",
  type: "telegram",
  cronExpression: "*/10 * * * * *",
  handler: async () => {
    await new AttendanceTelegramService().pollPersonalBotUpdates();
  }
};
