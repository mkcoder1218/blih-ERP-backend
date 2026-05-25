
import { db } from '../../models';
export class AuditLogDAL {
  findAll(query: any) { return db.AuditLog.findAll({ where: query, order: [['createdAt', 'DESC']] }); }
  findById(id: string) { return db.AuditLog.findByPk(id); }
}
