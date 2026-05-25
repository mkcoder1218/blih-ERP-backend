"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HRService = void 0;
const models_1 = require("../../models");
class HRService {
    async provisionTemplates(businessId) {
        const templates = [
            { key: 'employee_profile', title: 'Employee Profile Form' },
            { key: 'leave_request', title: 'Leave Request Form' },
            { key: 'attendance_correction', title: 'Attendance Correction Request Form' },
            { key: 'overtime_request', title: 'Overtime Request Form' },
            { key: 'recruitment_request', title: 'Recruitment Request Form' }
        ];
        for (const t of templates) {
            const existing = await models_1.db.FormDefinition.findOne({ where: { businessId, key: t.key } });
            if (!existing) {
                await models_1.db.FormDefinition.create({
                    businessId,
                    name: t.title,
                    key: t.key,
                    visibility: 'internal',
                    version: 1,
                    schema: { type: 'object', properties: {} }
                });
            }
        }
    }
    // Record CRUD
    async getRecord(businessId, userId) {
        return models_1.db.EmployeeRecord.findOne({ where: { businessId, userId } });
    }
    async listRecords(where = {}, limit = 20, offset = 0) {
        return models_1.db.EmployeeRecord.findAndCountAll({ where, limit, offset, order: [['createdAt', 'DESC']] });
    }
    async createRecord(data) {
        return models_1.db.EmployeeRecord.create(data);
    }
    async updateRecord(id, businessId, data) {
        const rec = await models_1.db.EmployeeRecord.findOne({ where: { id, businessId } });
        if (!rec)
            throw new Error("Record not found");
        return rec.update(data);
    }
    async processLeaveDeduction(businessId, userId, type, requestedDays) {
        const year = new Date().getFullYear();
        const bal = await models_1.db.LeaveBalance.findOne({ where: { businessId, userId, leaveType: type, year } });
        if (!bal)
            throw new Error("Leave balance missing or not provisioned");
        if (bal.remainingDays < requestedDays)
            throw new Error("Insufficient leave balance");
        await bal.update({
            usedDays: bal.usedDays + requestedDays,
            remainingDays: bal.remainingDays - requestedDays
        });
        return bal;
    }
}
exports.HRService = HRService;
