"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationController = void 0;
const notification_service_1 = require("./notification.service");
class NotificationController {
    constructor() {
        this.service = new notification_service_1.NotificationService();
        this.list = async (req, res) => {
            // Business Admin logs check: allow them to view all (but controller filters body if needed?)
            // Request explicitly stated: "Business Admin can view business notification logs, but not private message content unless allowed"
            const bypassUser = req.user.isPlatformSuperAdmin || (res.locals.hasRole && res.locals.hasRole('BUSINESS_ADMIN'));
            const page = parseInt(req.query.page) || 1;
            const size = parseInt(req.query.size) || 20;
            const queryOptions = {
                status: req.query.status,
                type: req.query.type,
                moduleKey: req.query.moduleKey,
                priority: req.query.priority,
                overrideUserId: bypassUser && req.query.all === 'true'
            };
            const data = await this.service.list(req.user.businessId, req.user.id, queryOptions, page, size);
            // Filter message contents if seeing someone else's messages as Business Admin
            if (queryOptions.overrideUserId && !req.user.isPlatformSuperAdmin) {
                data.rows = data.rows.map((r) => {
                    const d = r.toJSON();
                    d.message = "*** Filtered for Privacy ***";
                    return d;
                });
            }
            res.json(data);
        };
        this.unreadCount = async (req, res) => {
            const count = await this.service.getUnreadCount(req.user.businessId, req.user.id);
            res.json({ unreadCount: count });
        };
        this.bulkCreate = async (req, res, next) => {
            try {
                await this.service.sendBulk({ ...req.body, businessId: req.user.businessId, senderUserId: req.user.id });
                res.status(201).json({ ok: true });
            }
            catch (err) {
                next({ statusCode: 400, message: err.message });
            }
        };
        this.markRead = async (req, res) => {
            await this.service.markAsRead(req.params.id, req.user.businessId, req.user.id);
            res.json({ ok: true });
        };
        this.markAllRead = async (req, res) => {
            await this.service.markAllAsRead(req.user.businessId, req.user.id);
            res.json({ ok: true });
        };
        this.archive = async (req, res) => {
            await this.service.archive(req.params.id, req.user.businessId, req.user.id);
            res.json({ ok: true });
        };
    }
}
exports.NotificationController = NotificationController;
