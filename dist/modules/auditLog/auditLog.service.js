"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogServiceRead = void 0;
const auditLog_dal_1 = require("./auditLog.dal");
class AuditLogServiceRead {
    constructor() {
        this.dal = new auditLog_dal_1.AuditLogDAL();
    }
    list(businessId) {
        return businessId ? this.dal.findAll({ businessId }) : this.dal.findAll({});
    }
    getById(id, businessId) {
        if (businessId)
            return this.dal.findAll({ id, businessId }).then((res) => res[0]);
        return this.dal.findById(id);
    }
}
exports.AuditLogServiceRead = AuditLogServiceRead;
