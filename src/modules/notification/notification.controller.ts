
import type { Request, Response, NextFunction } from 'express';
import { NotificationService } from './notification.service';
export class NotificationController {
  private service = new NotificationService();

  list = async (req: Request, res: Response) => {
    // Business Admin logs check: allow them to view all (but controller filters body if needed?)
    // Request explicitly stated: "Business Admin can view business notification logs, but not private message content unless allowed"
    const bypassUser = req.user!.isPlatformSuperAdmin || (res.locals.hasRole && res.locals.hasRole('BUSINESS_ADMIN'));

    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    const queryOptions: any = {
      status: req.query.status,
      type: req.query.type,
      moduleKey: req.query.moduleKey,
      priority: req.query.priority,
      overrideUserId: bypassUser && req.query.all === 'true'
    };

    const data = await this.service.list(req.user!.businessId, req.user!.id, queryOptions, page, size);

    // Filter message contents if seeing someone else's messages as Business Admin
    if (queryOptions.overrideUserId && !req.user!.isPlatformSuperAdmin) {
      data.rows = data.rows.map((r: any) => {
        const d = r.toJSON();
        d.message = "*** Filtered for Privacy ***";
        return d;
      });
    }

    res.json(data);
  };

  unreadCount = async (req: Request, res: Response) => {
    const count = await this.service.getUnreadCount(req.user!.businessId, req.user!.id);
    res.json({ unreadCount: count });
  };

  bulkCreate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.service.sendBulk({ ...req.body, businessId: req.user!.businessId, senderUserId: req.user!.id });
      res.status(201).json({ ok: true });
    } catch (err: any) { next({ statusCode: 400, message: err.message }); }
  };

  markRead = async (req: Request, res: Response) => {
    await this.service.markAsRead(req.params.id, req.user!.businessId, req.user!.id);
    res.json({ ok: true });
  };

  markAllRead = async (req: Request, res: Response) => {
    await this.service.markAllAsRead(req.user!.businessId, req.user!.id);
    res.json({ ok: true });
  };

  archive = async (req: Request, res: Response) => {
    await this.service.archive(req.params.id, req.user!.businessId, req.user!.id);
    res.json({ ok: true });
  };
}
