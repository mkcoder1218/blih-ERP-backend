"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HRService = void 0;
const sequelize_1 = require("sequelize");
const models_1 = require("../../models");
const employee_constants_1 = require("../../constants/employee.constants");
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
        const userWhere = where.employmentStatus === 'terminated'
            ? { status: { [sequelize_1.Op.in]: ['active', 'inactive'] } }
            : { status: 'active' };
        return models_1.db.EmployeeRecord.findAndCountAll({
            where,
            limit,
            offset,
            distinct: true,
            order: [['createdAt', 'DESC']],
            include: [
                {
                    model: models_1.db.User, as: 'user',
                    attributes: ['id', 'fullName', 'email', 'phone', 'status'],
                    include: [
                        {
                            model: models_1.db.Role,
                            attributes: ['id', 'name', 'key'],
                            through: { attributes: [] },
                            required: false,
                        },
                    ],
                    // Exclude self-registered users awaiting HR approval
                    where: userWhere,
                    required: true,
                },
                { model: models_1.db.Department, as: 'department', attributes: ['id', 'name'] },
                { model: models_1.db.Position, as: 'position', attributes: ['id', 'title'] },
            ],
        });
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
    async deleteRecord(businessId, userId) {
        const rec = await models_1.db.EmployeeRecord.findOne({ where: { businessId, userId } });
        if (!rec)
            throw new Error("Record not found");
        const transaction = await models_1.db.sequelize.transaction();
        try {
            await rec.destroy({ transaction });
            await models_1.db.BusinessUserProfile.destroy({ where: { businessId, userId }, transaction });
            await models_1.db.User.destroy({ where: { id: userId, businessId }, transaction });
            await transaction.commit();
        }
        catch (e) {
            await transaction.rollback();
            throw e;
        }
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
    async getOrganogram(businessId) {
        // ── 1. All active users ───────────────────────────────────────────────────
        const users = await models_1.db.User.findAll({
            where: { businessId, status: 'active' },
            attributes: ['id', 'fullName', 'email', 'isPlatformSuperAdmin'],
            include: [
                {
                    model: models_1.db.BusinessUserProfile,
                    required: false,
                    include: [
                        { model: models_1.db.Department, as: 'department', attributes: ['id', 'name'] },
                        { model: models_1.db.Position, as: 'position', attributes: ['id', 'title'] },
                    ],
                },
                {
                    model: models_1.db.Role,
                    through: { attributes: [] },
                    attributes: ['id', 'key', 'name'],
                },
            ],
        });
        // ── 2. Employee records ───────────────────────────────────────────────────
        const records = await models_1.db.EmployeeRecord.findAll({
            where: { businessId },
            attributes: ['userId', 'managerUserId', 'employmentStatus'],
            include: [
                { model: models_1.db.Department, as: 'department', attributes: ['id', 'name'] },
                { model: models_1.db.Position, as: 'position', attributes: ['id', 'title'] },
            ],
            paranoid: true,
        });
        const recordMap = new Map();
        records.forEach((r) => {
            const existing = recordMap.get(r.userId);
            if (!existing || r.employmentStatus === employee_constants_1.ACTIVE_EMPLOYMENT_STATUS)
                recordMap.set(r.userId, r);
        });
        // ── 3. Submitted onboardings — track hired-via-onboarding employees ───────
        // These users have employmentStatus=DEFAULT_EMPLOYMENT_STATUS in their record but ARE hired.
        // We use the onboarding's initializedById / offer's reportingManagerId as their manager.
        const submittedOnboardings = await models_1.db.CandidateOnboarding.findAll({
            where: { businessId, status: ['SUBMITTED_FOR_REVIEW', 'COMPLETED'] },
            attributes: ['candidateEmail', 'initializedById', 'offerId'],
        });
        // email (lowercase) → managerId
        const onboardingManagerByEmail = new Map();
        for (const ob of submittedOnboardings) {
            const email = (ob.candidateEmail || '').toLowerCase();
            if (!email)
                continue;
            let managerId = ob.initializedById || null;
            if (ob.offerId) {
                try {
                    const offer = await models_1.db.OfferLetter.findOne({
                        where: { id: ob.offerId },
                        attributes: ['reportingManagerId', 'createdById'],
                    });
                    managerId = offer?.reportingManagerId || ob.initializedById || offer?.createdById || null;
                }
                catch { /* offer may not exist */ }
            }
            onboardingManagerByEmail.set(email, managerId);
        }
        // ── 4. Role priority ──────────────────────────────────────────────────────
        const ROLE_PRIORITY = {
            BUSINESS_ADMIN: 0,
            HR_MANAGER: 1,
            FINANCE_MANAGER: 1,
            CRM_MANAGER: 1,
            PROJECT_MANAGER: 1,
            DEPARTMENT_HEAD: 2,
            EMPLOYEE: 3,
        };
        const getUserRole = (user) => {
            if (user.isPlatformSuperAdmin)
                return { key: 'PLATFORM_ADMIN', label: 'Platform Admin', priority: -1 };
            const roles = user.Roles || [];
            let best = { key: 'EMPLOYEE', label: 'Employee', priority: 3 };
            roles.forEach((r) => {
                const p = ROLE_PRIORITY[r.key] ?? 3;
                if (p < best.priority)
                    best = { key: r.key, label: r.name || r.key, priority: p };
            });
            return best;
        };
        // ── 5. Build node map ─────────────────────────────────────────────────────
        const departments = await models_1.db.Department.findAll({
            where: { businessId },
            attributes: ['id', 'name'],
            order: [['name', 'ASC']],
        });
        const departmentMap = new Map();
        departments.forEach((department) => {
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
        const people = [];
        users.forEach((u) => {
            const profile = u.BusinessUserProfile;
            const record = recordMap.get(u.id);
            const role = getUserRole(u);
            const department = profile?.department || record?.department || null;
            const position = profile?.position || record?.position || null;
            const email = (u.email || '').toLowerCase();
            const hiredViaOnboarding = onboardingManagerByEmail.has(email);
            // Exclude users who:
            //   - have no record OR record is 'onboarding'
            //   - AND are plain employees (no elevated role)
            //   - AND were NOT hired via a submitted onboarding
            const isPreHireOnly = (!record || record.employmentStatus === employee_constants_1.DEFAULT_EMPLOYMENT_STATUS) &&
                role.priority >= 3 &&
                !hiredViaOnboarding;
            if (isPreHireOnly)
                return;
            // Manager resolution: explicit record → onboarding-derived
            const managerId = record?.managerUserId ||
                (hiredViaOnboarding ? (onboardingManagerByEmail.get(email) ?? null) : null);
            people.push({
                id: u.id,
                userId: u.id,
                type: role.priority <= 0 ? 'admin' : 'employee',
                name: u.fullName,
                title: position?.title || role.label,
                department: department?.name || role.label,
                departmentId: department?.id || null,
                roleKey: role.key,
                rolePriority: role.priority,
                managerId,
                children: [],
            });
        });
        // ── 6. Pass 1 — wire explicit manager links ───────────────────────────────
        const byRoleThenName = (a, b) => a.rolePriority - b.rolePriority || a.name.localeCompare(b.name);
        const admins = people.filter((person) => person.rolePriority <= 0).sort(byRoleThenName);
        const departmentPeople = people.filter((person) => person.rolePriority > 0);
        const unassignedDepartment = {
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
        if (unassignedDepartment.children.length)
            departmentNodes.push(unassignedDepartment);
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
exports.HRService = HRService;
