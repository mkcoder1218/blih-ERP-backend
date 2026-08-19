import type { Request, Response } from "express";
import { errorResponse, successResponse } from "../../utils/response";
import { ProjectTelegramService } from "./projectTelegram.service";

export class ProjectTelegramController {
  private service = new ProjectTelegramService();

  getSettings = async (req: Request, res: Response) => {
    try {
      const data = await this.service.getSettings(req.user!.businessId);
      successResponse(res, data, "Telegram task sync settings");
    } catch (error: any) {
      errorResponse(res, error.message, error.statusCode || 400);
    }
  };

  upsertBotSetting = async (req: Request, res: Response) => {
    try {
      const data = await this.service.upsertBotSetting(req.user!.businessId, req.body || {});
      successResponse(res, data, "Telegram task bot settings updated");
    } catch (error: any) {
      errorResponse(res, error.message, error.statusCode || 400);
    }
  };

  upsertDepartment = async (req: Request, res: Response) => {
    try {
      const data = await this.service.upsertDepartment(req.user!.businessId, req.params.departmentId, req.body || {});
      successResponse(res, data, "Department Telegram routing updated");
    } catch (error: any) {
      errorResponse(res, error.message, error.statusCode || 400);
    }
  };

  testConnection = async (req: Request, res: Response) => {
    try {
      const data = await this.service.testConnection(req.user!.businessId);
      successResponse(res, data, "Telegram bot connection successful");
    } catch (error: any) {
      errorResponse(res, error.message, error.statusCode || 400);
    }
  };

  sendTestMessage = async (req: Request, res: Response) => {
    try {
      const data = await this.service.sendTestMessage(req.user!.businessId, req.body?.departmentId);
      successResponse(res, data, "Telegram test message sent");
    } catch (error: any) {
      errorResponse(res, error.message, error.statusCode || 400);
    }
  };

  sendTodayTasks = async (req: Request, res: Response) => {
    try {
      const data = await this.service.sendTodayTasks(req.user!.businessId);
      successResponse(res, data, data.sentTasks ? "Today's tasks sent to Telegram" : "No new tasks to send");
    } catch (error: any) {
      errorResponse(res, error.message, error.statusCode || 400);
    }
  };
}
