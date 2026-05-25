"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalNotifier = exports.NotificationService = void 0;
const notification_dal_1 = require("./notification.dal");
class NotificationService {
    constructor() {
        this.dal = new notification_dal_1.NotificationDAL();
    }
    list(businessId, userId, queryOptions, page, size) {
        const offset = (page - 1) * size;
        const query = { businessId, recipientUserId: userId };
        if (queryOptions.status)
            query.status = queryOptions.status;
        if (queryOptions.type)
            query.type = queryOptions.type;
        if (queryOptions.moduleKey)
            query.moduleKey = queryOptions.moduleKey;
        if (queryOptions.priority)
            query.priority = queryOptions.priority;
        // Admins can see all if they bypass recipientUserId. Controller dictates this.
        if (queryOptions.overrideUserId) {
            delete query.recipientUserId;
        }
        return this.dal.findAll(query, offset, size);
    }
    getUnreadCount(businessId, userId) {
        return this.dal.countUnread({ businessId, recipientUserId: userId });
    }
    // Generic internal Send mechanism
    async send(data) {
        // 1. In App Native Save
        const inApp = await this.dal.create(data);
        // 2. Email / SMS Placeholder (Real ERP would query NotificationPreferences here)
        // console.log(`[Email Channel Placeholder]: Sending Email to ${data.recipientUserId}`);
        // console.log(`[SMS Channel Placeholder]: Sending SMS to ${data.recipientUserId}`);
        return inApp;
    }
    async sendBulk(payload) {
        const records = payload.recipientUserIds.map((userId) => ({
            ...payload,
            recipientUserIds: undefined,
            recipientUserId: userId
        }));
        return this.dal.bulkCreate(records);
    }
    markAsRead(id, businessId, userId) { return this.dal.markAsRead(id, businessId, userId); }
    markAllAsRead(businessId, userId) { return this.dal.markAllAsRead(businessId, userId); }
    archive(id, businessId, userId) { return this.dal.archive(id, businessId, userId); }
}
exports.NotificationService = NotificationService;
exports.InternalNotifier = new NotificationService();
