
import { db } from '../../models';

export class HRService {
  
  async provisionTemplates(businessId: string) {
     const templates = [
        { key: 'employee_profile', title: 'Employee Profile Form' },
        { key: 'leave_request', title: 'Leave Request Form' },
        { key: 'attendance_correction', title: 'Attendance Correction Request Form' },
        { key: 'overtime_request', title: 'Overtime Request Form' },
        { key: 'recruitment_request', title: 'Recruitment Request Form' }
     ];
     for (const t of templates) {
        const existing = await db.FormDefinition.findOne({ where: { businessId, key: t.key } });
        if (!existing) {
           await db.FormDefinition.create({
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
  async getRecord(businessId: string, userId: string) {
     return db.EmployeeRecord.findOne({ where: { businessId, userId } });
  }

  async listRecords(where: any = {}, limit: number = 20, offset: number = 0) {
     return db.EmployeeRecord.findAndCountAll({ where, limit, offset, order: [['createdAt', 'DESC']] });
  }

  async createRecord(data: any) {
     return db.EmployeeRecord.create(data);
  }

  async updateRecord(id: string, businessId: string, data: any) {
     const rec = await db.EmployeeRecord.findOne({ where: { id, businessId } });
     if (!rec) throw new Error("Record not found");
     return rec.update(data);
  }

  async processLeaveDeduction(businessId: string, userId: string, type: string, requestedDays: number) {
     const year = new Date().getFullYear();
     const bal = await db.LeaveBalance.findOne({ where: { businessId, userId, leaveType: type, year } });
     if (!bal) throw new Error("Leave balance missing or not provisioned");
     if (bal.remainingDays < requestedDays) throw new Error("Insufficient leave balance");
     
     await bal.update({
        usedDays: bal.usedDays + requestedDays,
        remainingDays: bal.remainingDays - requestedDays
     });
     return bal;
  }
}
