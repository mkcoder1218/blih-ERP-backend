"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogServiceRead = void 0;
const auditLog_dal_1 = require("./auditLog.dal");
class AuditLogServiceRead {
    constructor() {
        this.dal = new auditLog_dal_1.AuditLogDAL();
    }
    listPaginated(filters) {
        return this.dal.findPaginated(filters);
    }
    getById(id, businessId) {
        // For non-super-admin, enforce the businessId guard at controller level
        return this.dal.findById(id);
    }
}
exports.AuditLogServiceRead = AuditLogServiceRead;
