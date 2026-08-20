import type { NextFunction, Request, Response } from "express";
import { CalendarGooglePolicyService } from "./calendarGooglePolicy.service";

export class CalendarGooglePolicyController {
  private svc = new CalendarGooglePolicyService();

  syncEvent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await this.svc.syncEvent(req.user!.businessId, req.user!.id, req.params.id);
      res.json({ event });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  syncAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.svc.syncAll(req.user!.businessId, req.user!.id));
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };
}
