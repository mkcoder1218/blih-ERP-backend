const mockTelegramBotSettingFindAll = jest.fn();

jest.mock("../src/models", () => ({
  db: {
    TelegramBotSetting: { findAll: mockTelegramBotSettingFindAll },
  },
}));

import { AttendanceTelegramService } from "../src/modules/attendanceTelegram/attendanceTelegram.service";

describe("AttendanceTelegramService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not resend the daily summary after it was already sent for the business date", async () => {
    const service = new AttendanceTelegramService();
    const sendSpy = jest.spyOn(service as any, "sendDailySummaryCsv").mockResolvedValue(undefined);

    mockTelegramBotSettingFindAll.mockResolvedValue([
      {
        businessId: "biz-1",
        botType: "ATTENDANCE_MAIN",
        enabled: true,
        botToken: "token",
        chatId: "chat-1",
        sendTime: "20:00",
        timezone: "Africa/Nairobi",
        lastSentForDate: "2026-06-22",
        lastSentAt: new Date("2026-06-22T17:00:00.000Z"),
        updatedAt: new Date("2026-06-22T17:00:01.000Z"),
        update: jest.fn(),
      },
    ]);

    await service.runDailySummarySweep(new Date("2026-06-22T17:48:00.000Z"));

    expect(sendSpy).not.toHaveBeenCalled();
  });
});
