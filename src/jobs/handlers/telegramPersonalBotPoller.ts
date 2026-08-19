import { JobDefinition } from "../runner";
import { AttendanceTelegramUpdateRouterService } from "../../modules/attendanceTelegram/attendanceTelegramUpdateRouter.service";

export const telegramPersonalBotPoller: JobDefinition = {
  name: "TelegramPersonalBotPoller",
  type: "telegram",
  cronExpression: "*/10 * * * * *",
  handler: async () => {
    await new AttendanceTelegramUpdateRouterService().pollPersonalBotUpdates();
  }
};
