import type { Request, Response, NextFunction } from "express";
import { ok } from "../../utils/apiResponse";
import { AttendanceMeService } from "./attendanceMe.service";

export class AttendanceMeController {
  private service = new AttendanceMeService();

  today = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const businessId = req.user!.businessId;
    const data = await this.service.getTodaySummary(userId, businessId);
    return ok(res, data, "Attendance (today)");
  };

  createEvent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const businessId = req.user!.businessId;
      const data = await this.service.createEvent(userId, businessId, req.body);
      return ok(res, data, "Attendance event recorded", 201);
    } catch (e: any) {
      return next({ statusCode: e.statusCode || 500, message: e.message || "Failed to record attendance event" });
    }
  };

  revertLastEvent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const businessId = req.user!.businessId;
      const data = await this.service.revertLastEvent(userId, businessId);
      return ok(res, data, "Last attendance event reverted");
    } catch (e: any) {
      return next({ statusCode: e.statusCode || 500, message: e.message || "Failed to revert attendance event" });
    }
  };

  history = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const businessId = req.user!.businessId;
    const q: any = req.query;
    const data = await this.service.getHistory(userId, businessId, q);
    return ok(res, data, "Attendance history");
  };
}
