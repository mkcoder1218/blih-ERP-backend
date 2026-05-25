
import { db } from '../../models';
export class NotificationDAL {
  findAll(query: any, offset: number, limit: number) { 
    return db.Notification.findAndCountAll({ where: query, offset, limit, order: [['createdAt', 'DESC']] }); 
  }
  countUnread(query: any) { return db.Notification.count({ where: { ...query, status: 'unread' } }); }
  findById(id: string, businessId: string) { return db.Notification.findOne({ where: { id, businessId } }); }
  create(data: any) { return db.Notification.create(data); }
  bulkCreate(data: any[]) { return db.Notification.bulkCreate(data); }
  markAsRead(id: string, businessId: string, userId: string) {
    return db.Notification.update({ status: 'read', readAt: new Date() }, { where: { id, businessId, recipientUserId: userId } });
  }
  markAllAsRead(businessId: string, userId: string) {
    return db.Notification.update({ status: 'read', readAt: new Date() }, { where: { businessId, recipientUserId: userId, status: 'unread' } });
  }
  archive(id: string, businessId: string, userId: string) {
    return db.Notification.update({ status: 'archived' }, { where: { id, businessId, recipientUserId: userId } });
  }
}
