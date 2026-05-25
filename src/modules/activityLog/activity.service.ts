
import { ActivityDAL } from './activity.dal';
import { Op } from 'sequelize';

export class ActivityService {
  private dal = new ActivityDAL();

  list(businessId: string, queryOpts: any, page: number, size: number) {
    const offset = (page - 1) * size;
    const query: any = { businessId };
    
    if (queryOpts.moduleKey) query.moduleKey = queryOpts.moduleKey;
    if (queryOpts.entityType) query.entityType = queryOpts.entityType;
    if (queryOpts.entityId) query.entityId = queryOpts.entityId;
    if (queryOpts.userId) query.userId = queryOpts.userId;
    
    if (queryOpts.startDate && queryOpts.endDate) {
      query.createdAt = { [Op.between]: [new Date(queryOpts.startDate), new Date(queryOpts.endDate)] };
    }

    return this.dal.findAll(query, offset, size);
  }

  // Internal Reusable dispatch mechanism mapped heavily by auditLog logic hook
  async log(data: { businessId: string; userId?: string; moduleKey: string; action: string; entityType: string; entityId: string; title: string; description?: string; metadata?: any }) {
    return this.dal.create(data);
  }
}

export const ActivityLogger = new ActivityService();
