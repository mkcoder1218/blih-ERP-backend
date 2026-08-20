import type { Request, Response, NextFunction } from "express";
import { CalendarService } from "./calendar.service";

export class CalendarController {
  private svc = new CalendarService();

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await this.svc.list(req.user!.businessId, req.user!.id, req.query);
      res.json({ rows });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  people = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await this.svc.listPeople(req.user!.businessId, req.query);
      res.json({ rows });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await this.svc.create(req.user!.businessId, req.user!.id, req.body);
      res.status(201).json({ event });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await this.svc.update(req.user!.businessId, req.user!.id, req.params.id, req.body);
      res.json({ event });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.svc.remove(req.user!.businessId, req.user!.id, req.params.id);
      res.status(204).send();
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  status = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.svc.status(req.user!.businessId, req.user!.id, req.query.at ? new Date(String(req.query.at)) : new Date());
      res.json(result);
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  createMeetingRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const request = await this.svc.createMeetingRequest(req.user!.businessId, req.user!.id, req.body);
      res.status(201).json({ request });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  meetingRequests = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await this.svc.listMeetingRequests(req.user!.businessId, req.user!.id, req.query);
      res.json({ rows });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  respondMeetingRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const request = await this.svc.respondMeetingRequest(req.user!.businessId, req.user!.id, req.params.id, req.body);
      res.json({ request });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  googleAuthUrl = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(this.svc.getGoogleAuthUrl(req.user!.businessId, req.user!.id));
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  googleConnection = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.svc.getGoogleConnection(req.user!.businessId, req.user!.id));
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  googleDisconnect = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.svc.disconnectGoogle(req.user!.businessId, req.user!.id);
      res.status(204).send();
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  googleCallback = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.query.error) {
        throw new Error(String(req.query.error_description || req.query.error));
      }
      await this.svc.handleGoogleCallback(String(req.query.code || ""), String(req.query.state || ""));
      res.type("html").send(`
        <!doctype html>
        <html>
          <head>
            <title>Google Calendar connected</title>
            <meta charset="utf-8" />
            <style>
              body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 32px; color: #0f172a; }
              h1 { font-size: 18px; margin: 0 0 8px; }
              p { color: #475569; font-size: 14px; }
            </style>
          </head>
          <body>
            <h1>Google Calendar connected</h1>
            <p>You can close this window and return to Blih.</p>
            <script>window.setTimeout(function(){ window.close(); }, 800);</script>
          </body>
        </html>
      `);
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  syncGoogle = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await this.svc.syncEventToGoogle(req.user!.businessId, req.user!.id, req.params.id);
      res.json({ event });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  syncAllGoogle = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.svc.syncAllEventsToGoogle(req.user!.businessId, req.user!.id));
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  syncFromGoogle = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await this.svc.syncFromGoogle(req.user!.businessId, req.user!.id));
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };
}
