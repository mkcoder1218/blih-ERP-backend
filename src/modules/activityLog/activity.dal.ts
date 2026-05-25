
import { db } from '../../models';
export class ActivityDAL {
  findAll(query: any, offset: number, limit: number) { 
    return db.ActivityLog.findAndCountAll({ where: query, offset, limit, order: [['createdAt', 'DESC']] }); 
  }
  create(data: any) { return db.ActivityLog.create(data); }
}
