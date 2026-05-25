
import { AuditLogDAL } from './auditLog.dal';
export class AuditLogServiceRead {
  private dal = new AuditLogDAL();
  list(businessId?: string) { 
    return businessId ? this.dal.findAll({ businessId }) : this.dal.findAll({});
  }
  getById(id: string, businessId?: string) {
    if(businessId) return this.dal.findAll({ id, businessId }).then((res: any[]) => res[0]);
    return this.dal.findById(id);
  }
}
