"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationDAL = void 0;
const models_1 = require("../../models");
class NotificationDAL {
    findAll(query, offset, limit) {
        return models_1.db.Notification.findAndCountAll({ where: query, offset, limit, order: [['createdAt', 'DESC']] });
    }
    countUnread(query) { return models_1.db.Notification.count({ where: { ...query, status: 'unread' } }); }
    findById(id, businessId) { return models_1.db.Notification.findOne({ where: { id, businessId } }); }
    create(data) { return models_1.db.Notification.create(data); }
    bulkCreate(data) { return models_1.db.Notification.bulkCreate(data); }
    markAsRead(id, businessId, userId) {
        return models_1.db.Notification.update({ status: 'read', readAt: new Date() }, { where: { id, businessId, recipientUserId: userId } });
    }
    markAllAsRead(businessId, userId) {
        return models_1.db.Notification.update({ status: 'read', readAt: new Date() }, { where: { businessId, recipientUserId: userId, status: 'unread' } });
    }
    archive(id, businessId, userId) {
        return models_1.db.Notification.update({ status: 'archived' }, { where: { id, businessId, recipientUserId: userId } });
    }
}
exports.NotificationDAL = NotificationDAL;
