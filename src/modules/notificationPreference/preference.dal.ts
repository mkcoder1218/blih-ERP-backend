
import { db } from '../../models';
export class PreferenceDAL {
  findForUser(businessId: string, userId: string) { return db.NotificationPreference.findAll({ where: { businessId, userId }}); }
  async upsert(data: any) {
    // Basic match
    const existing = await db.NotificationPreference.findOne({ where: { businessId: data.businessId, userId: data.userId, channel: data.channel, moduleKey: data.moduleKey, type: data.type }});
    if (existing) return existing.update(data);
    return db.NotificationPreference.create(data);
  }
}
