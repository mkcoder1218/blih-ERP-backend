import type { NextFunction, Request, Response } from "express";
import { CalendarMeetingService } from "./calendarMeeting.service";

export class CalendarMeetingController {
  private svc = new CalendarMeetingService();

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await this.svc.list(req.user!.businessId, req.user!.id, req.query);
      res.json({ rows });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message, conflicts: err.conflicts });
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const meeting = await this.svc.create(req.user!.businessId, req.user!.id, req.body);
      res.status(201).json({ meeting });
    } catch (err: any) {
      if (err.statusCode === 409) {
        res.status(409).json({ message: err.message, conflicts: err.conflicts || [] });
        return;
      }
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  availability = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.svc.availability(req.user!.businessId, req.user!.id, req.body));
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  commonTimes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.svc.commonTimes(req.user!.businessId, req.user!.id, req.body));
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  respond = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const meeting = await this.svc.respond(req.user!.businessId, req.user!.id, req.params.id, req.body);
      res.json({ meeting });
    } catch (err: any) {
      if (err.statusCode === 409) {
        res.status(409).json({ message: err.message, conflicts: err.conflicts || [] });
        return;
      }
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const meeting = await this.svc.update(req.user!.businessId, req.user!.id, req.params.id, req.body);
      res.json({ meeting });
    } catch (err: any) {
      if (err.statusCode === 409) {
        res.status(409).json({ message: err.message, conflicts: err.conflicts || [] });
        return;
      }
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const meeting = await this.svc.cancel(req.user!.businessId, req.user!.id, req.params.id);
      res.json({ meeting });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  eventDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const meeting = await this.svc.eventDetails(req.user!.businessId, req.params.eventId, req.user!.id);
      res.json({ meeting });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };
}
