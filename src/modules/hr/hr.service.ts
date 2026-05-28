
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
     return db.EmployeeRecord.findAndCountAll({
        where, 
        limit, 
        offset, 
        order: [['createdAt', 'DESC']],
        include: [
           { model: db.User, as: 'user', attributes: ['id', 'fullName', 'email', 'phone'] },
           { model: db.Department, as: 'department', attributes: ['id', 'name'] },
           { model: db.Position, as: 'position', attributes: ['id', 'title'] }
        ]
     });
  }

  async createRecord(data: any) {
     return db.EmployeeRecord.create(data);
  }

  async updateRecord(id: string, businessId: string, data: any) {
     const rec = await db.EmployeeRecord.findOne({ where: { id, businessId } });
     if (!rec) throw new Error("Record not found");
     return rec.update(data);
  }

  async deleteRecord(businessId: string, userId: string) {
     const rec = await db.EmployeeRecord.findOne({ where: { businessId, userId } });
     if (!rec) throw new Error("Record not found");
     
     const transaction = await db.sequelize.transaction();
     try {
        await rec.destroy({ transaction });
        await db.BusinessUserProfile.destroy({ where: { businessId, userId }, transaction });
        await db.User.destroy({ where: { id: userId, businessId }, transaction });
        await transaction.commit();
     } catch (e) {
        await transaction.rollback();
        throw e;
     }
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

  async getOrganogram(businessId: string) {
    // 1. Fetch all active users and their related HR/Profile data
    const users = await db.User.findAll({
      where: { businessId, status: 'active' },
      include: [
        { model: db.BusinessUserProfile, required: false, include: [
          { model: db.Department, as: 'department', attributes: ['id', 'name'] },
          { model: db.Position, as: 'position', attributes: ['id', 'title'] }
        ] }
      ]
    });

    // 2. Fetch all employee records to get the reporting relationships (managerUserId)
    const records = await db.EmployeeRecord.findAll({
      where: { businessId },
      attributes: ['userId', 'managerUserId', 'departmentId', 'positionId'],
      include: [
        { model: db.Department, as: 'department', attributes: ['id', 'name'] },
        { model: db.Position, as: 'position', attributes: ['id', 'title'] }
      ]
    });

    const recordMap = new Map();
    records.forEach(r => recordMap.set(r.userId, r));

    const nodeMap = new Map();
    const tree: any[] = [];

    // 3. Create nodes for every user
    users.forEach((u: any) => {
      const record = recordMap.get(u.id);
      const profile = u.BusinessUserProfile;
      
      const node = {
        id: u.id,
        name: u.fullName,
        title: record?.position?.title || profile?.position?.title || (u.isPlatformSuperAdmin ? 'Platform Admin' : 'Staff'),
        department: record?.department?.name || profile?.department?.name || 'General',
        managerId: record?.managerUserId || null,
        avatar: null,
        children: []
      };
      nodeMap.set(node.id, node);
    });

    // 4. Build the tree
    nodeMap.forEach(node => {
      if (node.managerId && nodeMap.has(node.managerId) && node.managerId !== node.id) {
        nodeMap.get(node.managerId).children.push(node);
      } else {
        tree.push(node);
      }
    });

    // 5. If we have multiple roots but one is clearly an Admin/CEO, we could potentially group others under them, 
    // but usually multiple roots are shown side-by-side in a recursive tree if they don't report to anyone.
    
    return tree;
  }
}
