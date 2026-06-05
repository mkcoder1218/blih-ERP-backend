"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HRPerformanceService = void 0;
const models_1 = require("../../models");
const employee_constants_1 = require("../../constants/employee.constants");
const sequelize_1 = require("sequelize");
const COMPLETED_TASK_STATUSES = new Set(['DONE', 'COMPLETED', 'APPROVED']);
const APPROVED_TASK_STATUSES = new Set(['APPROVED']);
const BLOCKED_TASK_STATUSES = new Set(['BLOCKED']);
const EXCLUDED_BLOCKER_TYPES = new Set(['dependency', 'client', 'resource', 'management']);
class HRPerformanceService {
    async provisionForms(businessId) {
        const templates = [
            { key: 'performance_review', title: 'Performance Review Form' },
            { key: 'probation_evaluation', title: 'Probation Evaluation Form' },
            { key: 'training_request', title: 'Training Request Form' },
            { key: 'training_feedback', title: 'Training Feedback Form' },
            { key: 'skill_gap_assess', title: 'Skill Gap Assessment Form' },
            { key: 'disciplinary_action', title: 'Disciplinary Action / Grievance Form' },
            { key: 'incident_report', title: 'Incident Report Form' },
            { key: 'employee_resignation', title: 'Employee Resignation Form' },
            { key: 'exit_interview', title: 'Exit Interview Form' },
            { key: 'offboarding_checklist', title: 'Offboarding Checklist Form' },
            { key: 'asset_return_clearance', title: 'Asset Return & Clearance Form' },
            { key: 'experience_letter', title: 'Experience Letter & Final Pay Request Form' }
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
    async processExit(businessId, employeeUserId, exitId, status) {
        const p = await models_1.db.ExitProcess.findOne({ where: { id: exitId, businessId, employeeUserId } });
        if (!p)
            throw new Error("Exit Process not mapping natively.");
        if (status === 'completed') {
            const emp = await models_1.db.EmployeeRecord.findOne({ where: { businessId, userId: employeeUserId } });
            if (emp)
                await emp.update({ employmentStatus: employee_constants_1.TERMINATED_EMPLOYMENT_STATUS });
            // Normally disable db.User connection access implicitly here
        }
        else if (status === 'in_progress') {
            const emp = await models_1.db.EmployeeRecord.findOne({ where: { businessId, userId: employeeUserId } });
            if (emp)
                await emp.update({ employmentStatus: employee_constants_1.INACTIVE_EMPLOYMENT_STATUS });
        }
        return p.update({ status });
    }
    async restrictDisciplinaryAccess(businessId, requestingUser) {
        // A generic bounding utility structurally resolving HR mapping roles 
        const isHRAdmin = requestingUser.roles.some((role) => ['SUPER_ADMIN', 'BUSINESS_ADMIN', 'HR_MANAGER'].includes(role));
        if (!isHRAdmin) {
            throw new Error("Strict structural isolation prevents non-HR operators resolving sensitive disciplinary cases.");
        }
    }
    async getProjectPerformanceDashboard(businessId, filters = {}) {
        const employeeWhere = { businessId };
        if (filters.employeeUserId)
            employeeWhere.userId = filters.employeeUserId;
        if (filters.employeeId)
            employeeWhere.id = filters.employeeId;
        if (filters.departmentId)
            employeeWhere.departmentId = filters.departmentId;
        if (filters.team)
            employeeWhere[sequelize_1.Op.or] = [
                { '$department.name$': { [sequelize_1.Op.iLike]: `%${filters.team}%` } },
                { employeeCode: { [sequelize_1.Op.iLike]: `%${filters.team}%` } }
            ];
        const employees = await models_1.db.EmployeeRecord.findAll({
            where: employeeWhere,
            include: [
                { model: models_1.db.User, as: 'user', attributes: ['id', 'fullName', 'email'] },
                { model: models_1.db.Department, as: 'department', attributes: ['id', 'name'] }
            ]
        });
        const rows = await Promise.all(employees.map((employee) => this.getEmployeeProjectMetrics(businessId, employee.userId, filters)));
        return { filters: this.normalizePeriodFilters(filters), rows };
    }
    async getEmployeeEvaluationEvidence(businessId, employeeUserId, filters = {}) {
        const metrics = await this.getEmployeeProjectMetrics(businessId, employeeUserId, filters);
        return { projectMetrics: metrics, scoringNote: 'Project metrics are supporting evidence only; managers retain final KPI, OKR, and overall scores.' };
    }
    async getPerformanceOverview(businessId, filters = {}) {
        const reviews = await models_1.db.PerformanceReview.findAll({
            where: { businessId },
            include: [
                { model: models_1.db.User, as: 'employee', attributes: ['id', 'fullName', 'email'] },
                { model: models_1.db.User, as: 'reviewer', attributes: ['id', 'fullName', 'email'] }
            ],
            order: [['periodEnd', 'DESC']]
        });
        const employeeRecords = await models_1.db.EmployeeRecord.findAll({
            where: { businessId },
            include: [{ model: models_1.db.Department, as: 'department', attributes: ['id', 'name'] }]
        });
        const employeeByUserId = new Map(employeeRecords.map((employee) => [employee.userId, employee]));
        const activeOkrs = await models_1.db.Objective.count({ where: { businessId, status: 'active' } });
        const keyResults = await models_1.db.KeyResult.findAll({ where: { businessId } });
        const onTrackOkrs = keyResults.length
            ? Math.round((keyResults.filter((kr) => ['on_track', 'achieved'].includes(String(kr.status).toLowerCase())).length / keyResults.length) * 100)
            : 0;
        const scoredReviews = reviews.filter((review) => Number.isFinite(Number(review.score)));
        const topEmployees = scoredReviews
            .slice()
            .sort((a, b) => Number(b.score) - Number(a.score))
            .slice(0, 9)
            .map((review) => {
            const employeeRecord = employeeByUserId.get(review.employeeUserId);
            return {
                reviewId: review.id,
                employeeUserId: review.employeeUserId,
                name: review.employee?.fullName || review.employee?.email || 'Employee',
                department: employeeRecord?.department?.name || 'Unassigned',
                score: Number(review.score),
                okrScore: Number(review.reviewData?.okrScore ?? review.reviewData?.okr?.score ?? 0)
            };
        });
        const departmentGroups = new Map();
        for (const employee of employeeRecords) {
            const departmentId = employee.department?.id || 'unassigned';
            const existing = departmentGroups.get(departmentId) || {
                id: employee.department?.id || null,
                name: employee.department?.name || 'Unassigned',
                count: 0,
                totalScore: 0,
                scoredCount: 0
            };
            existing.count += 1;
            departmentGroups.set(departmentId, existing);
        }
        for (const review of scoredReviews) {
            const employeeRecord = employeeByUserId.get(review.employeeUserId);
            const departmentId = employeeRecord?.department?.id || 'unassigned';
            const existing = departmentGroups.get(departmentId) || {
                id: employeeRecord?.department?.id || null,
                name: employeeRecord?.department?.name || 'Unassigned',
                count: 0,
                totalScore: 0,
                scoredCount: 0
            };
            existing.totalScore += Number(review.score);
            existing.scoredCount += 1;
            departmentGroups.set(departmentId, existing);
        }
        const trendMap = new Map();
        for (const review of scoredReviews) {
            const monthKey = this.monthLabel(review.periodEnd || review.updatedAt || review.createdAt);
            const existing = trendMap.get(monthKey) || { total: 0, count: 0 };
            existing.total += Number(review.score);
            existing.count += 1;
            trendMap.set(monthKey, existing);
        }
        const distribution = { exceeds: 0, meets: 0, below: 0, needsImprovement: 0 };
        for (const review of scoredReviews) {
            const score = Number(review.score);
            if (score >= 4.5)
                distribution.exceeds += 1;
            else if (score >= 3.5)
                distribution.meets += 1;
            else if (score >= 2.5)
                distribution.below += 1;
            else
                distribution.needsImprovement += 1;
        }
        const projectDashboard = await this.getProjectPerformanceDashboard(businessId, filters);
        return {
            summary: {
                mostImprovedDepartment: this.mostImprovedDepartment(Array.from(departmentGroups.values())),
                reviewsDue: reviews.filter((review) => !['completed', 'finalized', 'acknowledged'].includes(String(review.status).toLowerCase())).length,
                activeOkrs,
                onTrackOkrs
            },
            topEmployees,
            trend: Array.from(trendMap.entries()).map(([month, value]) => ({ month, score: value.count ? Number((value.total / value.count).toFixed(1)) : 0 })),
            distribution,
            departments: Array.from(departmentGroups.values()).map((department) => ({
                id: department.id,
                name: department.name,
                employeeCount: department.count,
                averageScore: department.scoredCount ? Number((department.totalScore / department.scoredCount).toFixed(1)) : null
            })),
            projectDashboard
        };
    }
    async listPerformanceReviews(businessId, filters = {}) {
        const where = { businessId };
        if (filters.status)
            where.status = filters.status;
        if (filters.periodStart || filters.periodEnd) {
            where.periodEnd = this.dateRange(filters.periodStart, filters.periodEnd);
        }
        const reviews = await models_1.db.PerformanceReview.findAll({
            where,
            include: [
                { model: models_1.db.User, as: 'employee', attributes: ['id', 'fullName', 'email'] },
                { model: models_1.db.User, as: 'reviewer', attributes: ['id', 'fullName', 'email'] }
            ],
            order: [['updatedAt', 'DESC']]
        });
        const employeeRecords = await models_1.db.EmployeeRecord.findAll({
            where: { businessId, userId: { [sequelize_1.Op.in]: reviews.map((review) => review.employeeUserId) } },
            include: [{ model: models_1.db.Department, as: 'department', attributes: ['id', 'name'] }]
        });
        const employeeByUserId = new Map(employeeRecords.map((employee) => [employee.userId, employee]));
        return Promise.all(reviews.map(async (review) => {
            const employeeRecord = employeeByUserId.get(review.employeeUserId);
            const evidence = await this.getEmployeeProjectMetrics(businessId, review.employeeUserId, {
                periodStart: review.periodStart,
                periodEnd: review.periodEnd
            });
            return {
                id: review.id,
                employeeUserId: review.employeeUserId,
                employeeName: review.employee?.fullName || review.employee?.email || 'Employee',
                employeeEmail: review.employee?.email,
                department: employeeRecord?.department ? { id: employeeRecord.department.id, name: employeeRecord.department.name } : null,
                reviewerName: review.reviewer?.fullName || review.reviewer?.email || null,
                periodType: review.periodType,
                periodStart: review.periodStart,
                periodEnd: review.periodEnd,
                score: review.score,
                status: review.status,
                reviewData: review.reviewData || {},
                projectEvidence: evidence
            };
        }));
    }
    async attachProjectEvidenceToReview(businessId, reviewId) {
        const review = await models_1.db.PerformanceReview.findOne({ where: { id: reviewId, businessId } });
        if (!review)
            throw new Error('Performance review not found');
        const evidence = await this.getEmployeeEvaluationEvidence(businessId, review.employeeUserId, {
            periodStart: review.periodStart,
            periodEnd: review.periodEnd
        });
        const reviewData = { ...(review.reviewData || {}), evidence: { ...(review.reviewData?.evidence || {}), projectMetrics: evidence.projectMetrics } };
        await review.update({ reviewData });
        return review;
    }
    async getEmployeeProjectMetrics(businessId, employeeUserId, filters = {}) {
        const employee = await models_1.db.EmployeeRecord.findOne({
            where: { businessId, userId: employeeUserId },
            include: [
                { model: models_1.db.User, as: 'user', attributes: ['id', 'fullName', 'email'] },
                { model: models_1.db.Department, as: 'department', attributes: ['id', 'name'] }
            ]
        });
        if (!employee)
            throw new Error('Employee not found');
        const period = this.normalizePeriodFilters(filters);
        const where = { businessId, assigneeEmployeeId: employee.id };
        if (filters.projectId)
            where.projectId = filters.projectId;
        if (filters.status)
            where.status = String(filters.status).toUpperCase();
        if (period.periodStart || period.periodEnd) {
            where[sequelize_1.Op.or] = [
                { createdAt: this.dateRange(period.periodStart, period.periodEnd) },
                { dueDate: this.dateOnlyRange(period.periodStart, period.periodEnd) }
            ];
        }
        const tasks = await models_1.db.ProjectTask.findAll({
            where,
            include: [{ model: models_1.db.Project, attributes: ['id', 'title', 'code', 'status'] }],
            order: [['dueDate', 'ASC']]
        });
        const taskIds = tasks.map((task) => task.id);
        const reopenedLogs = taskIds.length ? await models_1.db.ProjectActivityLog.findAll({
            where: {
                businessId,
                taskId: { [sequelize_1.Op.in]: taskIds },
                action: 'PROJECT_TASK_STATUS_CHANGED'
            }
        }) : [];
        const reopenedTaskIds = new Set(reopenedLogs
            .filter((log) => COMPLETED_TASK_STATUSES.has(this.statusOf(log.before)) && !COMPLETED_TASK_STATUSES.has(this.statusOf(log.after)))
            .map((log) => log.taskId));
        const today = new Date().toISOString().slice(0, 10);
        const summary = {
            assignedTasks: tasks.length,
            assignedWeight: 0,
            completedTasks: 0,
            completedWeight: 0,
            overdueTasks: 0,
            overdueWeight: 0,
            onTimeTasks: 0,
            onTimeWeight: 0,
            blockedTasks: 0,
            blockedWeight: 0,
            reopenedTasks: reopenedTaskIds.size,
            reopenedWeight: 0,
            approvedTasks: 0,
            approvedWeight: 0,
            latePenaltyExcludedTasks: 0,
            weightedCompletionRate: 0,
            onTimeCompletionRate: 0
        };
        const evidenceTasks = tasks.map((task) => {
            const status = this.statusOf(task);
            const weight = this.taskWeight(task);
            const completed = COMPLETED_TASK_STATUSES.has(status);
            const approved = APPROVED_TASK_STATUSES.has(status) || task.metadata?.approved === true || task.metadata?.approvalStatus === 'approved';
            const blocked = BLOCKED_TASK_STATUSES.has(status);
            const excludedLatePenalty = this.hasApprovedExcludedBlocker(task);
            const overdue = Boolean(task.dueDate && task.dueDate < today && !completed && !excludedLatePenalty);
            const onTime = Boolean(completed && task.dueDate && task.updatedAt && this.dateOnly(task.updatedAt) <= task.dueDate);
            summary.assignedWeight += weight;
            if (completed) {
                summary.completedTasks += 1;
                summary.completedWeight += weight;
            }
            if (approved) {
                summary.approvedTasks += 1;
                summary.approvedWeight += weight;
            }
            if (blocked) {
                summary.blockedTasks += 1;
                summary.blockedWeight += weight;
            }
            if (overdue) {
                summary.overdueTasks += 1;
                summary.overdueWeight += weight;
            }
            if (onTime) {
                summary.onTimeTasks += 1;
                summary.onTimeWeight += weight;
            }
            if (reopenedTaskIds.has(task.id))
                summary.reopenedWeight += weight;
            if (excludedLatePenalty)
                summary.latePenaltyExcludedTasks += 1;
            return {
                id: task.id, code: task.code, title: task.title, status, dueDate: task.dueDate,
                weight, project: task.Project ? { id: task.Project.id, code: task.Project.code, title: task.Project.title } : null,
                overdue, onTime, blocked, reopened: reopenedTaskIds.has(task.id), approved, excludedLatePenalty
            };
        });
        summary.weightedCompletionRate = summary.assignedWeight ? Math.round((summary.completedWeight / summary.assignedWeight) * 100) : 0;
        summary.onTimeCompletionRate = summary.completedWeight ? Math.round((summary.onTimeWeight / summary.completedWeight) * 100) : 0;
        return {
            employee: {
                id: employee.id,
                userId: employee.userId,
                name: employee.user?.fullName,
                email: employee.user?.email,
                department: employee.department ? { id: employee.department.id, name: employee.department.name } : null
            },
            period,
            summary,
            tasks: evidenceTasks
        };
    }
    normalizePeriodFilters(filters) {
        return {
            periodStart: filters.periodStart ? this.dateOnly(filters.periodStart) : undefined,
            periodEnd: filters.periodEnd ? this.dateOnly(filters.periodEnd) : undefined
        };
    }
    dateRange(periodStart, periodEnd) {
        const range = {};
        if (periodStart)
            range[sequelize_1.Op.gte] = new Date(periodStart);
        if (periodEnd)
            range[sequelize_1.Op.lte] = new Date(`${periodEnd}T23:59:59.999Z`);
        return range;
    }
    dateOnlyRange(periodStart, periodEnd) {
        const range = {};
        if (periodStart)
            range[sequelize_1.Op.gte] = periodStart;
        if (periodEnd)
            range[sequelize_1.Op.lte] = periodEnd;
        return range;
    }
    statusOf(value) {
        return String(value?.status || '').toUpperCase();
    }
    dateOnly(value) {
        return new Date(value).toISOString().slice(0, 10);
    }
    taskWeight(task) {
        const parsed = Number(task.weight ?? task.metadata?.weight ?? 1);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    }
    hasApprovedExcludedBlocker(task) {
        const blocker = task.metadata?.blocker || task.metadata?.lateBlocker || {};
        const type = String(blocker.type || task.metadata?.blockerType || '').toLowerCase();
        const approved = blocker.approved === true || task.metadata?.blockerApproved === true || task.metadata?.approvalStatus === 'approved';
        return approved && EXCLUDED_BLOCKER_TYPES.has(type);
    }
    monthLabel(value) {
        return new Date(value).toLocaleString('en-US', { month: 'short' });
    }
    mostImprovedDepartment(departments) {
        const scored = departments
            .filter((department) => department.scoredCount > 0)
            .sort((a, b) => (b.totalScore / b.scoredCount) - (a.totalScore / a.scoredCount));
        return scored[0]?.name || null;
    }
}
exports.HRPerformanceService = HRPerformanceService;
