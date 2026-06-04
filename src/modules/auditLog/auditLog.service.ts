import { AuditLogDAL, type AuditLogFilters } from "./auditLog.dal";

export class AuditLogServiceRead {
  private dal = new AuditLogDAL();

  listPaginated(filters: AuditLogFilters) {
    return this.dal.findPaginated(filters);
  }

  getById(id: string, businessId?: string) {
    // For non-super-admin, enforce the businessId guard at controller level
    return this.dal.findById(id);
  }
}
