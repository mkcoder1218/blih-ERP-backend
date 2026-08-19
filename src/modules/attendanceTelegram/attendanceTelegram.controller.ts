import type { NextFunction, Request, Response } from "express";
import { ok } from "../../utils/apiResponse";
import { AttendanceTelegramService } from "./attendanceTelegram.service";
import { AttendanceTelegramFlowService } from "./attendanceTelegramFlow.service";
import { AttendanceTelegramUpdateRouterService } from "./attendanceTelegramUpdateRouter.service";

export class AttendanceTelegramController {
  private service = new AttendanceTelegramService();
  private flow = new AttendanceTelegramFlowService();
  private updateRouter = new AttendanceTelegramUpdateRouterService();

  settings = async (req: Request, res: Response) => {
    return ok(res, { telegramSettings: await this.service.getSettings(req.params.businessId) }, "Telegram settings");
  };

  upsertSetting = async (req: Request, res: Response) => {
    return ok(res, { telegramSetting: await this.service.upsertSetting(req.params.businessId, req.params.botType as any, req.body) }, "Telegram setting updated");
  };

  sendTest = async (req: Request, res: Response) => {
    return ok(res, await this.service.sendTest(req.params.businessId, req.params.botType as any), "Telegram test sent");
  };

  sendBusinessTest = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.businessId) return next({ statusCode: 401, message: "Business workspace is required" });
    return ok(res, await this.service.sendTest(req.user.businessId, req.params.botType as any), "Telegram test sent");
  };

  sendBusinessGroupMessageTest = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.businessId) return next({ statusCode: 401, message: "Business workspace is required" });
    return ok(res, await this.service.sendGroupMessageTest(req.user.businessId, req.body?.message), "Telegram message test sent");
  };

  generateLinkCode = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.id || !req.user?.businessId) return next({ statusCode: 401, message: "Unauthorized" });
    return ok(res, { telegramLinkCode: await this.flow.generateLinkCode(req.user.id, req.user.businessId) }, "Telegram link code generated");
  };

  myStatus = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.id || !req.user?.businessId) return next({ statusCode: 401, message: "Unauthorized" });
    return ok(res, { telegramStatus: await this.flow.getMyStatus(req.user.id, req.user.businessId) }, "Telegram status");
  };

  unlinkMe = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user?.id || !req.user?.businessId) return next({ statusCode: 401, message: "Unauthorized" });
    return ok(res, await this.service.unlinkUser(req.user.id, req.user.businessId), "Telegram account unlinked");
  };

  adminUnlinkUser = async (req: Request, res: Response) => {
    return ok(res, await this.service.adminUnlinkUser(req.params.businessId, req.params.userId), "Telegram access disabled");
  };

  webhook = async (req: Request, res: Response) => {
    return ok(res, await this.updateRouter.handleUpdate(req.params.businessId, req.body), "Telegram update handled");
  };
}
