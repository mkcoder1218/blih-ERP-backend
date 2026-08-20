
import { Op } from 'sequelize';
import { db } from '../../models';
import { ACTIVE_EMPLOYMENT_STATUS, DEFAULT_EMPLOYMENT_STATUS } from '../../constants/employee.constants';

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
     const userWhere = where.employmentStatus === 'terminated'
       ? { status: { [Op.in]: ['active', 'inactive'] }, isTestAccount: false }
       : { status: 'active', isTestAccount: false };
     return db.EmployeeRecord.findAndCountAll({
        where,
        limit,
        offset,
        distinct: true,
        order: [['createdAt', 'DESC']],
        include: [
           {
             model: db.User, as: 'user',
             attributes: ['id', 'fullName', 'email', 'phone', 'status'],
             include: [
                {
                   model: db.Role,
                   attributes: ['id', 'name', 'key'],
                   through: { attributes: [] },
                   required: false,
                },
             ],
             // Exclude self-registered users awaiting HR approval and tester identities.
             where: userWhere,
             required: true,
           },
           { model: db.Department, as: 'department', attributes: ['id', 'name'] },
           { model: db.Position,   as: 'position',   attributes: ['id', 'title'] },
        ],
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
    // ── 1. All active non-test users ──────────────────────────────────────────
    const users = await db.User.findAll({
      where: { businessId, status: 'active', isTestAccount: false },
      attributes: ['id', 'fullName', 'email', 'isPlatformSuperAdmin'],
      include: [
        {
          model: db.BusinessUserProfile,
          required: false,
          include: [
            { model: db.Department, as: 'department', attributes: ['id', 'name'] },
            { model: db.Position,   as: 'position',   attributes: ['id', 'title'] },
          ],
        },
        {
          model: db.Role,
          through: { attributes: [] },
          attributes: ['id', 'key', 'name'],
        },
      ],
    });

    // ── 2. Employee records ───────────────────────────────────────────────────
    const records = await db.EmployeeRecord.findAll({
      where: {
        businessId,
        employmentStatus: { [Op.ne]: 'TEST' },
      },
      attributes: ['userId', 'managerUserId', 'employmentStatus'],
      include: [
        { model: db.Department, as: 'department', attributes: ['id', 'name'] },
        { model: db.Position, as: 'position', attributes: ['id', 'title'] },
      ],
      paranoid: true,
    });
    const recordMap = new Map<string, any>();
    records.forEach((r: any) => {
      const existing = recordMap.get(r.userId);
      if (!existing || r.employmentStatus === ACTIVE_EMPLOYMENT_STATUS) recordMap.set(r.userId, r);
    });

    // ── 3. Submitted onboardings — track hired-via-onboarding employees ───────
    // These users have employmentStatus=DEFAULT_EMPLOYMENT_STATUS in their record but ARE hired.
    // We use the onboarding's initializedById / offer's reportingManagerId as their manager.
    const submittedOnboardings = await db.CandidateOnboarding.findAll({
      where: { businessId, status: ['SUBMITTED_FOR_REVIEW', 'COMPLETED'] },
      attributes: ['candidateEmail', 'initializedById', 'offerId'],
    });

    // email (lowercase) → managerId
    const onboardingManagerByEmail = new Map<string, string | null>();
    for (const ob of submittedOnboardings) {
      const email = (ob.candidateEmail || '').toLowerCase();
      if (!email) continue;
      let managerId: string | null = ob.initializedById || null;
      if (ob.offerId) {
        try {
          const offer = await db.OfferLetter.findOne({
            where: { id: ob.offerId },
            attributes: ['reportingManagerId', 'createdById'],
          });
          managerId = offer?.reportingManagerId || ob.initializedById || offer?.createdById || null;
        } catch { /* offer may not exist */ }
      }
      onboardingManagerByEmail.set(email, managerId);
    }

    // ── 4. Role priority ──────────────────────────────────────────────────────
    const ROLE_PRIORITY: Record<string, number> = {
      BUSINESS_ADMIN:  0,
      HR_MANAGER:      1,
      FINANCE_MANAGER: 1,
      CRM_MANAGER:     1,
      PROJECT_MANAGER: 1,
      DEPARTMENT_HEAD: 2,
      EMPLOYEE:        3,
    };

    const getUserRole = (user: any) => {
      if (user.isPlatformSuperAdmin) return { key: 'PLATFORM_ADMIN', label: 'Platform Admin', priority: -1 };
      const roles: any[] = user.Roles || [];
      let best = { key: 'EMPLOYEE', label: 'Employee', priority: 3 };
      roles.forEach((r: any) => {
        const p = ROLE_PRIORITY[r.key] ?? 3;
        if (p < best.priority) best = { key: r.key, label: r.name || r.key, priority: p };
      });
      return best;
    };

    // ── 5. Build node map ─────────────────────────────────────────────────────
    const departments = await db.Department.findAll({
      where: { businessId },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    });

    const departmentMap = new Map<string, any>();
    departments.forEach((department: any) => {
      departmentMap.set(department.id, {
        id: `department:${department.id}`,
        departmentId: department.id,
        type: 'department',
        name: department.name,
        title: 'Department',
        department: '',
        children: [],
      });
    });

    const people: any[] = [];

    users.forEach((u: any) => {
      const profile  = u.BusinessUserProfile;
      const record   = recordMap.get(u.id);
      const role     = getUserRole(u);
      const department = profile?.department || record?.department || null;
      const position = profile?.position || record?.position || null;
      const email    = (u.email || '').toLowerCase();
      const hiredViaOnboarding = onboardingManagerByEmail.has(email);

      // Exclude users who:
      //   - have no record OR record is 'onboarding'
      //   - AND are plain employees (no elevated role)
      //   - AND were NOT hired via a submitted onboarding
      const isPreHireOnly =
        (!record || record.employmentStatus === DEFAULT_EMPLOYMENT_STATUS) &&
        role.priority >= 3 &&
        !hiredViaOnboarding;

      if (isPreHireOnly) return;

      // Manager resolution: explicit record → onboarding-derived
      const managerId =
        record?.managerUserId ||
        (hiredViaOnboarding ? (onboardingManagerByEmail.get(email) ?? null) : null);

      people.push({
        id:           u.id,
        userId:       u.id,
        type:         role.priority <= 0 ? 'admin' : 'employee',
        name:         u.fullName,
        title:        position?.title || role.label,
        department:   department?.name || role.label,
        departmentId: department?.id || null,
        roleKey:      role.key,
        rolePriority: role.priority,
        managerId,
        children:     [],
      });
    });

    // ── 6. Pass 1 — wire explicit manager links ───────────────────────────────
    const byRoleThenName = (a: any, b: any) =>
      a.rolePriority - b.rolePriority || a.name.localeCompare(b.name);

    const admins = people.filter((person) => person.rolePriority <= 0).sort(byRoleThenName);
    const departmentPeople = people.filter((person) => person.rolePriority > 0);
    const unassignedDepartment: any = {
      id: 'department:unassigned',
      departmentId: null,
      type: 'department',
      name: 'Unassigned',
      title: 'Department not set',
      department: '',
      children: [],
    };

    departmentPeople.forEach((person) => {
      const departmentNode = person.departmentId
        ? departmentMap.get(person.departmentId) || unassignedDepartment
        : unassignedDepartment;
      departmentNode.children.push(person);
    });

    const departmentNodes = Array.from(departmentMap.values());
    if (unassignedDepartment.children.length) departmentNodes.push(unassignedDepartment);

    departmentNodes.forEach((departmentNode) => {
      departmentNode.children.sort(byRoleThenName);
      departmentNode.title = `${departmentNode.children.length} ${departmentNode.children.length === 1 ? 'person' : 'people'}`;
    });

    const populatedDepartments = departmentNodes
      .filter((departmentNode) => departmentNode.children.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (admins.length) {
      const root = admins[0];
      root.children = [...admins.slice(1), ...populatedDepartments];
      return [root];
    }

    return populatedDepartments;
  }
}
