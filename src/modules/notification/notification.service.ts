
import { NotificationDAL } from './notification.dal';

export class NotificationService {
  private dal = new NotificationDAL();

  list(businessId: string, userId: string, queryOptions: any, page: number, size: number) {
    const offset = (page - 1) * size;
    const query: any = { businessId, recipientUserId: userId };
    if (queryOptions.status) query.status = queryOptions.status;
    if (queryOptions.type) query.type = queryOptions.type;
    if (queryOptions.moduleKey) query.moduleKey = queryOptions.moduleKey;
    if (queryOptions.priority) query.priority = queryOptions.priority;
    
    // Admins can see all if they bypass recipientUserId. Controller dictates this.
    if (queryOptions.overrideUserId) {
        delete query.recipientUserId;
    }

    return this.dal.findAll(query, offset, size);
  }

  getUnreadCount(businessId: string, userId: string) {
    return this.dal.countUnread({ businessId, recipientUserId: userId });
  }

  // Generic internal Send mechanism
  async send(data: {
    businessId: string;
    recipientUserId: string;
    senderUserId?: string;
    moduleKey: string;
    type: string;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
    priority?: string;
    metadata?: any;
  }) {
    // 1. In App Native Save
    const inApp = await this.dal.create(data);

    // 2. Email / SMS Placeholder (Real ERP would query NotificationPreferences here)
    // console.log(`[Email Channel Placeholder]: Sending Email to ${data.recipientUserId}`);
    // console.log(`[SMS Channel Placeholder]: Sending SMS to ${data.recipientUserId}`);

    return inApp;
  }

  async sendBulk(payload: any) {
    const records = payload.recipientUserIds.map((userId: string) => ({
      ...payload,
      recipientUserIds: undefined,
      recipientUserId: userId
    }));
    return this.dal.bulkCreate(records);
  }

  markAsRead(id: string, businessId: string, userId: string) { return this.dal.markAsRead(id, businessId, userId); }
  markAllAsRead(businessId: string, userId: string) { return this.dal.markAllAsRead(businessId, userId); }
  archive(id: string, businessId: string, userId: string) { return this.dal.archive(id, businessId, userId); }
}

export const InternalNotifier = new NotificationService();
