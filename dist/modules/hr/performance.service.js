"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HRPerformanceService = exports.EXIT_DOCUMENT_DEFINITIONS = exports.EXIT_CLEARANCE_STEP_DEFINITIONS = void 0;
const sequelize_1 = require("sequelize");
const employee_constants_1 = require("../../constants/employee.constants");
const models_1 = require("../../models");
const attendanceDailyReport_service_1 = require("../../services/attendanceDailyReport.service");
const mailer_1 = require("../../services/mailer");
const COMPLETED_TASK_STATUSES = new Set(['DONE', 'COMPLETED', 'APPROVED']);
const APPROVED_TASK_STATUSES = new Set(['APPROVED']);
const BLOCKED_TASK_STATUSES = new Set(['BLOCKED']);
const EXCLUDED_BLOCKER_TYPES = new Set(['dependency', 'client', 'resource', 'management']);
const PROBATION_WEIGHT_SETTING_KEY = 'probation_assessment_weights';
const DEFAULT_PROBATION_WEIGHTS = { punctualityWeight: 30, attendanceWeight: 30, performanceWeight: 40 };
const EXIT_STATUS_TRANSITIONS = {
    pending: new Set(['in_progress', 'cancelled', 'rejected', 'interview_scheduled']),
    interview_scheduled: new Set(['interview_completed', 'in_progress', 'cancelled', 'rejected']),
    interview_completed: new Set(['in_progress', 'completed', 'cancelled', 'rejected']),
    rejected: new Set(['pending']),
    cancelled: new Set(['pending']),
    in_progress: new Set(['completed', 'cancelled', 'clearance_pending']),
    clearance_pending: new Set(['completed', 'cancelled']),
    completed: new Set(['account_disabled'])
};
exports.EXIT_CLEARANCE_STEP_DEFINITIONS = [
    {
        stepKey: 'resignation_letter_signed',
        title: 'Resignation Letter Received & Signed',
        description: 'Official resignation letter submitted and acknowledged'
    },
    {
        stepKey: 'exit_interview_completed',
        title: 'Exit Interview Completed',
        description: 'Exit interview conducted and documented'
    },
    {
        stepKey: 'assets_credentials_returned',
        title: 'Assets & Credentials Returned',
        description: 'Company property, ID card, access cards, and equipment returned'
    },
    {
        stepKey: 'final_payment_settled',
        title: 'Last Payment Settled',
        description: 'Final salary, benefits, and dues cleared'
    },
    {
        stepKey: 'experience_letter_issued',
        title: 'Experience Letter Issued',
        description: 'Official experience certificates provided'
    },
    {
        stepKey: 'recommendation_letter_issued',
        title: 'Recommendation Letter (if applicable)',
        description: 'Letter of recommendation for future employment'
    }
];
exports.EXIT_DOCUMENT_DEFINITIONS = [
    { documentKey: 'clearance_letter', title: 'Clearance Letter' },
    { documentKey: 'id_card', title: 'ID Card' },
    { documentKey: 'emergency_contact', title: 'Emergency Contact' },
    { documentKey: 'guarantor_info', title: 'Guarantor Info' },
    { documentKey: 'experience_letter', title: 'Experience Letter' }
];
class HRPerformanceService {
    constructor() {
        this.dailyAttendanceReport = new attendanceDailyReport_service_1.AttendanceDailyReportService();
    }
    ymd(value) {
        return value.toISOString().slice(0, 10);
    }
    clampScore(value) {
        if (!Number.isFinite(value))
            return 0;
        return Math.max(0, Math.min(100, Math.round(value)));
    }
    normalizeReviewScore(value) {
        const score = Number(value ?? 0);
        if (!Number.isFinite(score) || score <= 0)
            return 0;
        return this.clampScore(score <= 5 ? score * 20 : score);
    }
    async probationWeights(businessId) {
        const setting = await models_1.db.BusinessSetting.findOne({ where: { businessId, key: PROBATION_WEIGHT_SETTING_KEY } });
        const raw = setting?.value || {};
        const weights = {
            punctualityWeight: Number(raw.punctualityWeight ?? DEFAULT_PROBATION_WEIGHTS.punctualityWeight),
            attendanceWeight: Number(raw.attendanceWeight ?? DEFAULT_PROBATION_WEIGHTS.attendanceWeight),
            performanceWeight: Number(raw.performanceWeight ?? DEFAULT_PROBATION_WEIGHTS.performanceWeight),
        };
        const total = weights.punctualityWeight + weights.attendanceWeight + weights.performanceWeight;
        return total === 100 ? weights : DEFAULT_PROBATION_WEIGHTS;
    }
    async updateProbationWeights(businessId, input) {
        const weights = {
            punctualityWeight: Number(input?.punctualityWeight),
            attendanceWeight: Number(input?.attendanceWeight),
            performanceWeight: Number(input?.performanceWeight),
        };
        const total = weights.punctualityWeight + weights.attendanceWeight + weights.performanceWeight;
        if (!Object.values(weights).every((value) => Number.isFinite(value) && value >= 0 && value <= 100) || total !== 100) {
            throw new Error('Probation assessment weights must be valid percentages and total 100%.');
        }
        const [setting] = await models_1.db.BusinessSetting.findOrCreate({
            where: { businessId, key: PROBATION_WEIGHT_SETTING_KEY },
            defaults: { businessId, key: PROBATION_WEIGHT_SETTING_KEY, value: weights, category: 'performance', isPublic: false },
        });
        await setting.update({ value: weights, category: 'performance', isPublic: false });
        return weights;
    }
    async probationAttendanceScores(businessId, employeeUserId, startDate, endDate) {
        const rows = await this.dailyAttendanceReport.generate(businessId, { startDate, endDate, employeeId: employeeUserId });
        const scheduledRows = rows.filter((row) => Number(row.ScheduledWorkingDays || 0) > 0 && Number(row.PaidDaysOff || 0) <= 0);
        const scheduledDays = scheduledRows.reduce((sum, row) => sum + Number(row.ScheduledWorkingDays || 0), 0);
        const expectedMinutes = scheduledRows.reduce((sum, row) => sum + Number(row.ExpectedMinutes || 0), 0);
        const workedMinutes = scheduledRows.reduce((sum, row) => sum + Math.round(Number(row.NetHoursWorked || 0) * 60), 0);
        const lateArrivals = scheduledRows.filter((row) => Number(row.MinutesLate || 0) > 0).length;
        const absences = scheduledRows.filter((row) => row.LatenessStatus === 'Absent').length;
        const missingCheckouts = scheduledRows.filter((row) => row.LatenessStatus === 'IncompletePunch').length;
        const penaltyDays = scheduledRows.filter((row) => row.DeductionApplied).length;
        const attendanceScore = expectedMinutes > 0 ? this.clampScore((workedMinutes / expectedMinutes) * 100) : 0;
        const punctualityPenalty = lateArrivals * 5 + absences * 12 + missingCheckouts * 8 + penaltyDays * 5;
        const punctualityScore = scheduledDays > 0 ? this.clampScore(100 - punctualityPenalty) : 0;
        return {
            punctualityScore,
            attendanceScore,
            breakdown: {
                scheduledDays,
                expectedMinutes,
                workedMinutes,
                lateArrivals,
                absences,
                missingCheckouts,
                penaltyDays,
            },
        };
    }
    async probationReviewScore(businessId, employeeUserId, startDate, endDate) {
        const reviews = await models_1.db.PerformanceReview.findAll({
            where: {
                businessId,
                employeeUserId,
                periodType: { [sequelize_1.Op.iLike]: 'probation' },
                periodEnd: { [sequelize_1.Op.gte]: startDate, [sequelize_1.Op.lte]: endDate },
            },
            include: [{ model: models_1.db.User, as: 'reviewer', attributes: ['id', 'fullName', 'email'] }],
            order: [['periodEnd', 'DESC']],
        });
        const scored = reviews.map((review) => this.normalizeReviewScore(review.score)).filter((score) => score > 0);
        return {
            performanceScore: scored.length ? this.clampScore(scored.reduce((sum, score) => sum + score, 0) / scored.length) : 0,
            reviews: reviews.map((review) => ({
                id: review.id,
                periodStart: review.periodStart,
                periodEnd: review.periodEnd,
                score: this.normalizeReviewScore(review.score),
                status: review.status,
                reviewerName: review.reviewer?.fullName || review.reviewer?.email || null,
                reviewData: review.reviewData || {},
            })),
        };
    }
    async getProbationDashboard(businessId, filters = {}) {
        const now = new Date();
        const weights = await this.probationWeights(businessId);
        const where = {
            businessId,
            probationEndDate: { [sequelize_1.Op.ne]: null },
            employmentStatus: { [sequelize_1.Op.ne]: employee_constants_1.TERMINATED_EMPLOYMENT_STATUS },
        };
        if (filters.departmentId)
            where.departmentId = filters.departmentId;
        if (filters.status === 'active')
            where.probationEndDate = { [sequelize_1.Op.gt]: now };
        if (filters.status === 'completed' || filters.status === 'pending_action')
            where.probationEndDate = { [sequelize_1.Op.lte]: now };
        if (filters.endFrom || filters.endTo) {
            where.probationEndDate = {
                ...(filters.endFrom ? { [sequelize_1.Op.gte]: new Date(String(filters.endFrom)) } : {}),
                ...(filters.endTo ? { [sequelize_1.Op.lte]: new Date(String(filters.endTo)) } : {}),
            };
        }
        const records = await models_1.db.EmployeeRecord.findAll({
            where,
            include: [
                { model: models_1.db.User, as: 'user', attributes: ['id', 'fullName', 'email', 'status'], where: { status: { [sequelize_1.Op.ne]: 'inactive' } }, required: true },
                { model: models_1.db.Department, as: 'department', attributes: ['id', 'name'] },
                { model: models_1.db.Position, as: 'position', attributes: ['id', 'title'] },
            ],
            order: [['probationEndDate', 'ASC']],
        });
        const search = String(filters.search || '').trim().toLowerCase();
        const rows = [];
        for (const record of records) {
            const employeeName = record.user?.fullName || record.user?.email || 'Employee';
            const haystack = `${employeeName} ${record.user?.email || ''} ${record.department?.name || ''} ${record.position?.title || ''}`.toLowerCase();
            if (search && !haystack.includes(search))
                continue;
            const startDateObj = new Date(record.contractStartDate || record.hireDate || record.createdAt);
            const endDateObj = new Date(record.probationEndDate);
            const startDate = this.ymd(startDateObj);
            const endDate = this.ymd(endDateObj);
            const daysRemaining = Math.max(0, Math.ceil((endDateObj.getTime() - now.getTime()) / 86400000));
            const completed = endDateObj.getTime() <= now.getTime();
            const attendance = await this.probationAttendanceScores(businessId, record.userId, startDate, endDate);
            const review = await this.probationReviewScore(businessId, record.userId, startDateObj, endDateObj);
            const finalScore = this.clampScore(attendance.punctualityScore * (weights.punctualityWeight / 100) +
                attendance.attendanceScore * (weights.attendanceWeight / 100) +
                review.performanceScore * (weights.performanceWeight / 100));
            const status = completed ? (record.completionEmailSentAt ? 'Completed' : 'Pending HR action') : daysRemaining <= 7 ? 'Ending soon' : 'Active';
            if (filters.status === 'pending_action' && status !== 'Pending HR action')
                continue;
            rows.push({
                employeeId: record.userId,
                employeeName,
                employeeEmail: record.user?.email || null,
                department: record.department ? { id: record.department.id, name: record.department.name } : null,
                position: record.position ? { id: record.position.id, title: record.position.title } : null,
                probationStartDate: startDate,
                probationEndDate: endDate,
                daysRemaining,
                countdownLabel: completed ? 'Completed' : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`,
                punctualityScore: attendance.punctualityScore,
                attendanceScore: attendance.attendanceScore,
                performanceScore: review.performanceScore,
                finalScore,
                status,
                probationCompletedAt: record.probationCompletedAt,
                completionEmailSentAt: record.completionEmailSentAt,
                weights,
                attendanceBreakdown: attendance.breakdown,
                reviews: review.reviews,
            });
        }
        const summary = {
            activeProbation: rows.filter((row) => row.status === 'Active' || row.status === 'Ending soon').length,
            endingWithin7Days: rows.filter((row) => row.daysRemaining > 0 && row.daysRemaining <= 7).length,
            completed: rows.filter((row) => row.status === 'Completed').length,
            pendingHrAction: rows.filter((row) => row.status === 'Pending HR action').length,
        };
        return { summary, weights, rows };
    }
    async processProbationCompletionNotifications() {
        const now = new Date();
        const records = await models_1.db.EmployeeRecord.findAll({
            where: {
                probationEndDate: { [sequelize_1.Op.lte]: now },
                employmentStatus: { [sequelize_1.Op.ne]: employee_constants_1.TERMINATED_EMPLOYMENT_STATUS },
                completionEmailSentAt: null,
            },
            include: [
                { model: models_1.db.User, as: 'user', attributes: ['id', 'fullName', 'email'] },
                { model: models_1.db.Business, attributes: ['id', 'name'] },
            ],
        });
        let sent = 0;
        for (const record of records) {
            const hrManagers = await models_1.db.User.findAll({
                where: { businessId: record.businessId, status: 'active' },
                include: [{ model: models_1.db.Role, where: { key: 'HR_MANAGER' }, required: true }],
            });
            if (!record.probationCompletedAt)
                await record.update({ probationCompletedAt: now });
            const employeeName = record.user?.fullName || record.user?.email || 'Employee';
            for (const manager of hrManagers) {
                await (0, mailer_1.sendMail)({
                    to: manager.email,
                    subject: `Probation ended: ${employeeName}`,
                    text: `The probation period for ${employeeName} has ended. Please contact the employee and process contract renewal or termination.`,
                    html: `<p>The probation period for <strong>${employeeName}</strong> has ended. Please contact the employee and process contract renewal or termination.</p>`,
                });
            }
            await record.update({ completionEmailSentAt: new Date() });
            sent += hrManagers.length;
        }
        return { scanned: records.length, emailsSent: sent };
    }
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
            const existing = await models_1.db.FormDefinition.findOne({ where: { businessId, moduleKey: 'hr', key: t.key } });
            if (!existing) {
                await models_1.db.FormDefinition.create({
                    businessId,
                    moduleKey: 'hr',
                    name: t.title,
                    key: t.key,
                    description: `${t.title} template`,
                    status: 'active',
                    settings: {
                        category: t.key.startsWith('exit') || ['employee_resignation', 'offboarding_checklist', 'asset_return_clearance', 'experience_letter'].includes(t.key) ? 'exit' : 'performance',
                        version: 1,
                        schema: { type: 'object', properties: {} }
                    }
                });
            }
        }
    }
    async processExit(businessId, exitId, status, options = {}) {
        const exitProcess = await models_1.db.ExitProcess.findOne({
            where: {
                id: exitId,
                businessId,
            },
        });
        if (!exitProcess) {
            throw new Error("Exit process not found.");
        }
        const currentStatus = String(exitProcess.status || "pending");
        if (!EXIT_STATUS_TRANSITIONS[currentStatus]?.has(status)) {
            throw new Error(`Invalid exit status transition from ${currentStatus} to ${status}.`);
        }
        const employeeUserId = exitProcess.employeeUserId;
        const payload = {
            status,
        };
        if ([
            "in_progress",
            "clearance_pending",
            "completed",
            "rejected",
            "cancelled",
        ].includes(status)) {
            payload.reviewedByUserId =
                options.reviewedByUserId;
            payload.reviewedAt =
                new Date();
        }
        if (status === "in_progress" ||
            status === "clearance_pending") {
            payload.effectiveDate =
                options.effectiveDate ||
                    exitProcess.effectiveDate;
            payload.approvalNote =
                options.approvalNote ??
                    exitProcess.approvalNote;
            payload.rejectionReason = null;
            /*
             * Approval starts the notice or clearance
             * process. It must not put the employee
             * on leave or deactivate the account.
             */
            const employeeRecord = await models_1.db.EmployeeRecord.findOne({
                where: {
                    businessId,
                    userId: employeeUserId,
                },
            });
            if (employeeRecord &&
                employeeRecord.employmentStatus !==
                    employee_constants_1.ACTIVE_EMPLOYMENT_STATUS) {
                await employeeRecord.update({
                    employmentStatus: employee_constants_1.ACTIVE_EMPLOYMENT_STATUS,
                });
            }
        }
        if (status === "rejected" ||
            status === "cancelled") {
            payload.rejectionReason =
                options.rejectionReason ??
                    exitProcess.rejectionReason;
            const employeeRecord = await models_1.db.EmployeeRecord.findOne({
                where: {
                    businessId,
                    userId: employeeUserId,
                },
            });
            if (employeeRecord &&
                employeeRecord.employmentStatus !==
                    employee_constants_1.ACTIVE_EMPLOYMENT_STATUS) {
                await employeeRecord.update({
                    employmentStatus: employee_constants_1.ACTIVE_EMPLOYMENT_STATUS,
                });
            }
        }
        if (status === "completed") {
            /*
             * Do not use the old leave-window rule.
             * Exit notice is controlled by effectiveDate
             * and noticePeriodDays.
             */
            const effectiveDate = exitProcess.effectiveDate
                ? new Date(exitProcess.effectiveDate)
                : null;
            if (!effectiveDate) {
                throw new Error("A final working date is required before completing the exit.");
            }
            effectiveDate.setHours(23, 59, 59, 999);
            if (effectiveDate.getTime() >
                Date.now()) {
                const daysRemaining = Math.ceil((effectiveDate.getTime() -
                    Date.now()) /
                    86400000);
                throw new Error(`The exit cannot be completed before the final working date (${daysRemaining} day(s) remaining).`);
            }
            await this.assertOffboardingCanComplete(businessId, exitProcess);
            const employeeRecord = await models_1.db.EmployeeRecord.findOne({
                where: {
                    businessId,
                    userId: employeeUserId,
                },
            });
            if (employeeRecord) {
                await employeeRecord.update({
                    employmentStatus: employee_constants_1.TERMINATED_EMPLOYMENT_STATUS,
                });
            }
            /*
             * Keep actual user deactivation in
             * disableOffboardingAccount().
             *
             * Completion means employment ended,
             * while account deactivation remains
             * an explicit final action.
             */
        }
        return exitProcess.update(payload);
    }
    assertLeaveWindowComplete(exitProcess) {
        const leaveEndsAt = exitProcess.leaveEndsAt ? new Date(exitProcess.leaveEndsAt) : null;
        if (!leaveEndsAt)
            throw new Error('Employee must be approved to on-leave status before final offboarding approval.');
        if (leaveEndsAt.getTime() > Date.now()) {
            const days = Math.ceil((leaveEndsAt.getTime() - Date.now()) / 86400000);
            throw new Error(`Final offboarding approval is available after the 30-day leave window ends (${days} day(s) remaining).`);
        }
    }
    async getAcceptedDevicesSnapshot(businessId, employeeUserId) {
        const devices = await models_1.db.InventoryItem.findAll({
            where: { businessId, assignedToUserId: employeeUserId },
            order: [['updatedAt', 'DESC']]
        });
        return devices.map((item) => ({
            id: item.id,
            name: item.name,
            category: item.category,
            assetTag: item.assetTag,
            serialNumber: item.serialNumber,
            condition: item.condition,
            status: item.status,
            acceptedAt: item.metadata?.acceptedAt || item.metadata?.employeeAcceptedAt || null,
            acceptanceStatus: item.metadata?.acceptanceStatus || item.metadata?.employeeAcceptanceStatus || 'assigned'
        }));
    }
    async sendOffboardingForm(businessId, exitId, actingUserId) {
        const exitProcess = await models_1.db.ExitProcess.findOne({ where: { id: exitId, businessId } });
        if (!exitProcess)
            throw new Error('Exit process not found.');
        if (!['in_progress', 'interview_completed', 'clearance_pending'].includes(exitProcess.status))
            throw new Error('Offboarding form can only be sent after the leave request is approved.');
        const acceptedDevices = await this.getAcceptedDevicesSnapshot(businessId, exitProcess.employeeUserId);
        return exitProcess.update({
            offboardingFormSentAt: new Date(),
            offboardingFormSentByUserId: actingUserId,
            offboardingFormData: {
                ...(exitProcess.offboardingFormData || {}),
                acceptedDevices,
                sentAt: new Date().toISOString()
            }
        });
    }
    async submitOffboardingForm(businessId, exitId, employeeUserId, data) {
        const exitProcess = await models_1.db.ExitProcess.findOne({ where: { id: exitId, businessId, employeeUserId } });
        if (!exitProcess)
            throw new Error('Exit process not found.');
        if (!exitProcess.offboardingFormSentAt)
            throw new Error('HR must send the offboarding form before it can be submitted.');
        const acceptedDevices = await this.getAcceptedDevicesSnapshot(businessId, employeeUserId);
        return exitProcess.update({
            offboardingFormSubmittedAt: new Date(),
            offboardingFormData: {
                ...(exitProcess.offboardingFormData || {}),
                ...(data || {}),
                acceptedDevices,
                submittedAt: new Date().toISOString()
            }
        });
    }
    async assertOffboardingCanComplete(businessId, exitProcess) {
        const interviews = await models_1.db.ExitInterview.findAll({ where: { businessId, exitProcessId: exitProcess.id } });
        const hasOpenInterview = interviews.some((item) => item.status === 'scheduled');
        if (hasOpenInterview)
            throw new Error('Exit interview must be completed, cancelled, or waived before completion.');
        const mandatorySteps = await models_1.db.ExitClearanceStep.findAll({ where: { businessId, exitProcessId: exitProcess.id, required: true } });
        const incompleteSteps = mandatorySteps.filter((step) => !['completed', 'waived'].includes(step.status));
        if (incompleteSteps.length)
            throw new Error('All mandatory clearance and checklist items must be completed before completion.');
        const mandatoryDocs = await models_1.db.ExitDocument.findAll({ where: { businessId, exitProcessId: exitProcess.id, required: true } });
        const incompleteDocs = mandatoryDocs.filter((doc) => !['uploaded', 'verified', 'waived'].includes(doc.status));
        if (incompleteDocs.length)
            throw new Error('All required documents must be generated, uploaded, verified, or waived before completion.');
    }
    async disableOffboardingAccount(businessId, exitId, actingUserId) {
        const exitProcess = await models_1.db.ExitProcess.findOne({ where: { id: exitId, businessId } });
        if (!exitProcess)
            throw new Error('Exit process not found.');
        if (exitProcess.status !== 'completed')
            throw new Error('Offboarding must be completed before account deactivation.');
        if (exitProcess.accountDisabledAt)
            return exitProcess;
        await models_1.db.User.update({ status: 'inactive' }, { where: { id: exitProcess.employeeUserId, businessId } });
        return exitProcess.update({
            status: 'account_disabled',
            accountDisabledAt: new Date(),
            accountDisabledByUserId: actingUserId
        });
    }
    async seedExitClearanceSteps(businessId, exitProcessId, transaction) {
        const existing = await models_1.db.ExitClearanceStep.count({ where: { businessId, exitProcessId }, transaction });
        if (existing > 0)
            return;
        await models_1.db.ExitClearanceStep.bulkCreate(exports.EXIT_CLEARANCE_STEP_DEFINITIONS.map((step, index) => ({
            businessId,
            exitProcessId,
            ...step,
            sortOrder: index + 1,
            required: true,
            status: 'pending'
        })), { transaction });
    }
    async seedExitDocuments(businessId, exitProcessId, transaction) {
        const existing = await models_1.db.ExitDocument.count({ where: { businessId, exitProcessId }, transaction });
        if (existing > 0)
            return;
        await models_1.db.ExitDocument.bulkCreate(exports.EXIT_DOCUMENT_DEFINITIONS.map((doc) => ({
            businessId,
            exitProcessId,
            ...doc,
            required: true,
            status: 'missing'
        })), { transaction });
    }
    async getExitWithClearance(businessId, exitId) {
        return models_1.db.ExitProcess.findOne({
            where: { id: exitId, businessId },
            include: [
                {
                    model: models_1.db.User,
                    as: 'employee',
                    attributes: ['id', 'fullName', 'email'],
                    include: [{
                            model: models_1.db.BusinessUserProfile,
                            required: false,
                            include: [
                                { model: models_1.db.Department, as: 'department', attributes: ['id', 'name'] },
                                { model: models_1.db.Position, as: 'position', attributes: ['id', 'title'] }
                            ]
                        }]
                },
                {
                    model: models_1.db.ExitClearanceStep,
                    as: 'clearanceSteps',
                    required: false,
                    include: [{ model: models_1.db.User, as: 'completedBy', attributes: ['id', 'fullName', 'email'] }]
                }
            ],
            order: [[{ model: models_1.db.ExitClearanceStep, as: 'clearanceSteps' }, 'sortOrder', 'ASC']]
        });
    }
    async updateClearanceStep(businessId, exitId, stepId, updates, actingUserId) {
        const exitProcess = await models_1.db.ExitProcess.findOne({ where: { id: exitId, businessId } });
        if (!exitProcess)
            throw new Error('Exit process not found.');
        const step = await models_1.db.ExitClearanceStep.findOne({ where: { id: stepId, exitProcessId: exitId, businessId } });
        if (!step)
            throw new Error('Clearance step not found.');
        const payload = {};
        if (updates.title !== undefined)
            payload.title = updates.title;
        if (updates.description !== undefined)
            payload.description = updates.description;
        if (updates.sortOrder !== undefined)
            payload.sortOrder = Number(updates.sortOrder);
        if (updates.required !== undefined)
            payload.required = Boolean(updates.required);
        if (updates.notes !== undefined)
            payload.notes = updates.notes;
        if (updates.status !== undefined) {
            if (!['pending', 'completed', 'waived', 'blocked'].includes(updates.status))
                throw new Error('Invalid clearance step status.');
            payload.status = updates.status;
            payload.completedAt = ['pending', 'blocked'].includes(updates.status) ? null : new Date();
            payload.completedByUserId = ['pending', 'blocked'].includes(updates.status) ? null : actingUserId;
            payload.blockedReason = updates.status === 'blocked' ? (updates.blockedReason || updates.notes || 'Blocked') : null;
        }
        if (updates.blockedReason !== undefined)
            payload.blockedReason = updates.blockedReason;
        if (updates.attachments !== undefined)
            payload.attachments = Array.isArray(updates.attachments) ? updates.attachments : [];
        return step.update(payload);
    }
    async completeClearanceStepByKey(businessId, exitProcessId, stepKey, actingUserId, transaction) {
        const step = await models_1.db.ExitClearanceStep.findOne({ where: { businessId, exitProcessId, stepKey }, transaction });
        if (!step || step.status === 'completed')
            return step;
        return step.update({
            status: 'completed',
            completedAt: new Date(),
            completedByUserId: actingUserId
        }, { transaction });
    }
    async updateFinalPay(businessId, exitId, actingUserId, data) {
        return models_1.db.sequelize.transaction(async (transaction) => {
            const exitProcess = await models_1.db.ExitProcess.findOne({ where: { id: exitId, businessId }, transaction, lock: true });
            if (!exitProcess)
                throw new Error('Exit process not found.');
            const nextStatus = data.status || exitProcess.finalPayData?.status || 'pending';
            if (!['pending', 'processing', 'settled'].includes(nextStatus))
                throw new Error('Invalid final pay status.');
            const finalPayData = {
                ...(exitProcess.finalPayData || {}),
                status: nextStatus,
                grossAmount: data.grossAmount !== undefined ? Number(data.grossAmount) : exitProcess.finalPayData?.grossAmount,
                deductions: data.deductions !== undefined ? Number(data.deductions) : exitProcess.finalPayData?.deductions,
                netAmount: data.netAmount !== undefined ? Number(data.netAmount) : exitProcess.finalPayData?.netAmount,
                notes: data.notes !== undefined ? data.notes : exitProcess.finalPayData?.notes,
                ...(nextStatus === 'settled' ? { settledAt: new Date().toISOString(), settledByUserId: actingUserId } : {})
            };
            const updated = await exitProcess.update({ finalPayData }, { transaction });
            if (nextStatus === 'settled') {
                await this.completeClearanceStepByKey(businessId, exitId, 'final_payment_settled', actingUserId, transaction);
            }
            return updated;
        });
    }
    async getExitAnalytics(businessId, filters = {}) {
        const now = new Date();
        const from = filters.from ? new Date(filters.from) : new Date(now.getFullYear(), now.getMonth() - 11, 1);
        const to = filters.to ? new Date(`${filters.to}T23:59:59.999Z`) : now;
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const exits = await models_1.db.ExitProcess.findAll({
            where: { businessId },
            include: [{
                    model: models_1.db.User,
                    as: 'employee',
                    attributes: ['id', 'fullName', 'email'],
                    include: [{
                            model: models_1.db.BusinessUserProfile,
                            required: false,
                            include: [
                                { model: models_1.db.Department, as: 'department', attributes: ['id', 'name'] },
                                { model: models_1.db.Position, as: 'position', attributes: ['id', 'title'] }
                            ]
                        }]
                }],
            order: [['createdAt', 'DESC']]
        });
        const interviews = await models_1.db.ExitInterview.findAll({ where: { businessId } });
        const clearanceSteps = await models_1.db.ExitClearanceStep.findAll({ where: { businessId } });
        const employees = await models_1.db.EmployeeRecord.findAll({
            where: { businessId },
            include: [{ model: models_1.db.Department, as: 'department', attributes: ['id', 'name'] }]
        });
        const activeExits = exits.filter((item) => ['pending', 'in_progress'].includes(item.status));
        const recentExits = exits.filter((item) => new Date(item.createdAt) >= from && new Date(item.createdAt) <= to);
        const reasonCounts = new Map();
        for (const item of recentExits) {
            const reason = item.reason || 'Unspecified';
            reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
        }
        const months = Array.from({ length: 12 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            return { key, month: d.toLocaleString('en-US', { month: 'short' }), exits: 0, hires: 0 };
        });
        const monthByKey = new Map(months.map((m) => [m.key, m]));
        for (const item of exits) {
            const d = new Date(item.createdAt);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const row = monthByKey.get(key);
            if (row)
                row.exits += 1;
        }
        for (const employee of employees) {
            const d = new Date(employee.createdAt);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const row = monthByKey.get(key);
            if (row)
                row.hires += 1;
        }
        const deptMap = new Map();
        for (const employee of employees) {
            const departmentId = employee.department?.id || 'unassigned';
            const row = deptMap.get(departmentId) || {
                departmentId: employee.department?.id || null,
                departmentName: employee.department?.name || 'Unassigned',
                employeeCount: 0,
                exits: 0,
                remaining: 0,
                attritionRate: 0
            };
            row.employeeCount += 1;
            deptMap.set(departmentId, row);
        }
        for (const item of exits) {
            const profile = item.employee?.BusinessUserProfile;
            const departmentId = profile?.department?.id || 'unassigned';
            const row = deptMap.get(departmentId) || {
                departmentId: profile?.department?.id || null,
                departmentName: profile?.department?.name || 'Unassigned',
                employeeCount: 0,
                exits: 0,
                remaining: 0,
                attritionRate: 0
            };
            row.exits += 1;
            deptMap.set(departmentId, row);
        }
        for (const row of deptMap.values()) {
            row.remaining = Math.max(row.employeeCount - row.exits, 0);
            row.attritionRate = row.employeeCount ? Number(((row.exits / row.employeeCount) * 100).toFixed(1)) : 0;
        }
        const activeNotifications = activeExits.slice(0, 6).map((item) => {
            const employee = item.employee;
            const name = employee?.fullName || employee?.email || 'Employee';
            const effectiveDate = item.effectiveDate ? new Date(item.effectiveDate) : null;
            const daysRemaining = effectiveDate ? Math.ceil((effectiveDate.getTime() - now.getTime()) / 86400000) : null;
            return {
                id: item.id,
                name,
                dept: employee?.BusinessUserProfile?.department?.name || 'Unassigned',
                initials: name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
                priority: daysRemaining !== null && daysRemaining <= 7 ? 'urgent' : daysRemaining !== null && daysRemaining <= 14 ? 'high' : 'low',
                text: `${item.reason || 'Resignation'} - notice period active.`,
                date: item.createdAt,
                remaining: daysRemaining === null ? 'No date set' : `${Math.max(daysRemaining, 0)} days remaining`
            };
        });
        return {
            activeResignations: activeExits.length,
            pendingInterviews: interviews.filter((item) => item.status === 'scheduled').length,
            clearancePending: clearanceSteps.filter((step) => step.status === 'pending').length,
            completedThisMonth: exits.filter((item) => item.status === 'completed' && new Date(item.updatedAt) >= monthStart).length,
            activeNotifications,
            topExitReasonsLast12Months: Array.from(reasonCounts.entries()).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
            monthlyTurnoverTrend: months.map(({ month, exits, hires }) => ({ month, exits, hires })),
            departmentAttritionAnalysis: Array.from(deptMap.values())
        };
    }
    exitProcessInclude() {
        return [{
                model: models_1.db.ExitProcess,
                as: 'exitProcess',
                include: [{
                        model: models_1.db.User,
                        as: 'employee',
                        attributes: ['id', 'fullName', 'email'],
                        include: [{
                                model: models_1.db.BusinessUserProfile,
                                required: false,
                                include: [
                                    { model: models_1.db.Department, as: 'department', attributes: ['id', 'name'] },
                                    { model: models_1.db.Position, as: 'position', attributes: ['id', 'title'] }
                                ]
                            }]
                    }]
            }];
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
