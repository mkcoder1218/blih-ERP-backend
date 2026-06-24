"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HRPerformanceController = void 0;
const performance_service_1 = require("./performance.service");
const response_1 = require("../../utils/response");
const auditLog_service_1 = require("../../services/auditLog.service");
const models_1 = require("../../models");
const notification_service_1 = require("../notification/notification.service");
const file_service_1 = require("../file/file.service");
const crypto_1 = __importDefault(require("crypto"));
class HRPerformanceController {
    constructor() {
        this.service = new performance_service_1.HRPerformanceService();
        this.fileService = new file_service_1.FileService();
        this.seedForms = async (req, res) => {
            await this.service.provisionForms(req.user.businessId);
            (0, response_1.successResponse)(res, null, "Performance and Exit templates seeded.");
        };
        // Training
        this.createTrainingRequest = async (req, res) => {
            try {
                const payload = { ...req.body, businessId: req.user.businessId };
                if (!payload.employeeUserId)
                    payload.employeeUserId = req.user.id;
                if (!payload.requestedByUserId)
                    payload.requestedByUserId = req.user.id;
                const r = await models_1.db.TrainingRecord.create(payload);
                await auditLog_service_1.AuditLogService.log('CREATED_TRAINING', 'hr_training_records', String(r.id), null, {}, req);
                (0, response_1.successResponse)(res, r, "Training mapping defined.", 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listTrainingRequests = async (req, res) => {
            try {
                const businessId = req.user.businessId;
                const canManage = this.hasPermission(req, 'performance.manage') || this.hasPermission(req, 'performance.read');
                const page = Number(req.query.page || 1);
                const size = Number(req.query.size || 20);
                const where = { businessId };
                if (!canManage)
                    where.employeeUserId = req.user.id; // employees see own only
                if (req.query.status)
                    where.status = req.query.status;
                if (req.query.employeeUserId && canManage)
                    where.employeeUserId = req.query.employeeUserId;
                const { count, rows } = await models_1.db.TrainingRecord.findAndCountAll({
                    where,
                    include: [
                        { model: models_1.db.User, as: 'employee', attributes: ['id', 'fullName', 'email'], required: false },
                        { model: models_1.db.User, as: 'requester', attributes: ['id', 'fullName'], required: false },
                    ],
                    order: [['createdAt', 'DESC']],
                    limit: size,
                    offset: (page - 1) * size,
                });
                (0, response_1.successResponse)(res, { rows, total: count, page, totalPages: Math.ceil(count / size) });
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.approveTrainingRequest = async (req, res) => {
            try {
                const r = await models_1.db.TrainingRecord.findOne({ where: { id: req.params.id, businessId: req.user.businessId } });
                if (!r)
                    return (0, response_1.errorResponse)(res, 'Training record not found', 404);
                if (r.status !== 'requested')
                    return (0, response_1.errorResponse)(res, 'Only requested records can be approved', 400);
                await r.update({ status: 'scheduled', resultData: { ...(r.resultData || {}), approvedBy: req.user.id, approvedAt: new Date(), comment: req.body.comment } });
                await auditLog_service_1.AuditLogService.log('APPROVED_TRAINING', 'hr_training_records', String(r.id), null, {}, req);
                (0, response_1.successResponse)(res, r, 'Training request approved.');
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.rejectTrainingRequest = async (req, res) => {
            try {
                const r = await models_1.db.TrainingRecord.findOne({ where: { id: req.params.id, businessId: req.user.businessId } });
                if (!r)
                    return (0, response_1.errorResponse)(res, 'Training record not found', 404);
                if (r.status !== 'requested')
                    return (0, response_1.errorResponse)(res, 'Only requested records can be rejected', 400);
                await r.update({ status: 'cancelled', resultData: { ...(r.resultData || {}), rejectedBy: req.user.id, rejectedAt: new Date(), reason: req.body.reason } });
                await auditLog_service_1.AuditLogService.log('REJECTED_TRAINING', 'hr_training_records', String(r.id), null, {}, req);
                (0, response_1.successResponse)(res, r, 'Training request rejected.');
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        // Promotion Requests
        this.createPromotionRequest = async (req, res) => {
            try {
                const { currentTitle, targetTitle, justification, department, kpiScore, yearsInRole, effectiveDate, employeeUserId } = req.body;
                if (!currentTitle || !targetTitle || !justification)
                    return (0, response_1.errorResponse)(res, 'currentTitle, targetTitle, and justification are required', 400);
                const r = await models_1.db.PromotionRequest.create({
                    businessId: req.user.businessId,
                    employeeUserId: employeeUserId || req.user.id,
                    requestedByUserId: req.user.id,
                    currentTitle, targetTitle, justification, department,
                    kpiScore: kpiScore ? parseFloat(kpiScore) : null,
                    yearsInRole: yearsInRole ? parseFloat(yearsInRole) : null,
                    effectiveDate: effectiveDate || null,
                    approvalStage: 'department_head',
                    status: 'pending',
                });
                await auditLog_service_1.AuditLogService.log('CREATED_PROMOTION_REQUEST', 'hr_promotion_requests', String(r.id), null, {}, req);
                (0, response_1.successResponse)(res, r, 'Promotion request submitted.', 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listPromotionRequests = async (req, res) => {
            try {
                const businessId = req.user.businessId;
                const canManage = this.hasPermission(req, 'performance.manage') || this.hasPermission(req, 'performance.read');
                const page = Number(req.query.page || 1);
                const size = Number(req.query.size || 20);
                const where = { businessId };
                if (!canManage)
                    where.employeeUserId = req.user.id;
                if (req.query.status)
                    where.status = req.query.status;
                if (req.query.employeeUserId && canManage)
                    where.employeeUserId = req.query.employeeUserId;
                const { count, rows } = await models_1.db.PromotionRequest.findAndCountAll({
                    where,
                    include: [
                        { model: models_1.db.User, as: 'employee', attributes: ['id', 'fullName', 'email'], required: false },
                        { model: models_1.db.User, as: 'requester', attributes: ['id', 'fullName'], required: false },
                    ],
                    order: [['createdAt', 'DESC']],
                    limit: size,
                    offset: (page - 1) * size,
                });
                (0, response_1.successResponse)(res, { rows, total: count, page, totalPages: Math.ceil(count / size) });
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.approvePromotionRequest = async (req, res) => {
            try {
                const r = await models_1.db.PromotionRequest.findOne({ where: { id: req.params.id, businessId: req.user.businessId } });
                if (!r)
                    return (0, response_1.errorResponse)(res, 'Promotion request not found', 404);
                if (r.status !== 'pending')
                    return (0, response_1.errorResponse)(res, 'Only pending requests can be approved', 400);
                // Multi-stage: dept_head → admin → approved
                let nextStage = 'admin';
                let nextStatus = 'pending';
                if (r.approvalStage === 'department_head') {
                    nextStage = 'admin';
                    nextStatus = 'pending';
                }
                else if (r.approvalStage === 'admin') {
                    nextStage = 'approved';
                    nextStatus = 'approved';
                }
                await r.update({
                    approvalStage: nextStage,
                    status: nextStatus,
                    deptHeadComment: r.approvalStage === 'department_head' ? (req.body.comment || null) : r.deptHeadComment,
                    adminComment: r.approvalStage === 'admin' ? (req.body.comment || null) : r.adminComment,
                });
                await auditLog_service_1.AuditLogService.log('APPROVED_PROMOTION_STAGE', 'hr_promotion_requests', String(r.id), null, { stage: r.approvalStage }, req);
                (0, response_1.successResponse)(res, r, nextStatus === 'approved' ? 'Promotion fully approved.' : 'Forwarded to next approver.');
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.rejectPromotionRequest = async (req, res) => {
            try {
                const r = await models_1.db.PromotionRequest.findOne({ where: { id: req.params.id, businessId: req.user.businessId } });
                if (!r)
                    return (0, response_1.errorResponse)(res, 'Promotion request not found', 404);
                if (r.status !== 'pending')
                    return (0, response_1.errorResponse)(res, 'Only pending requests can be rejected', 400);
                await r.update({ status: 'rejected', rejectionReason: req.body.reason || null });
                await auditLog_service_1.AuditLogService.log('REJECTED_PROMOTION', 'hr_promotion_requests', String(r.id), null, {}, req);
                (0, response_1.successResponse)(res, r, 'Promotion request rejected.');
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        // ── Disciplinary Cases ────────────────────────────────────────────────────
        /**
         * POST /hr/disciplinary/analyze-attendance
         *
         * Analyses attendance data (MISSED + LATE) for the past N days using the same
         * HR attendance report engine. For each employee above the infraction threshold:
         *   1. Auto-creates a DisciplinaryCase (attendance type) if one doesn't exist.
         *   2. Sends a notification directly to the EMPLOYEE (not admins).
         *
         * Body params (all optional):
         *   windowDays        — look-back window in days                   (default 30)
         *   lateThreshold     — min infraction days to trigger a case      (default 3)
         *   dryRun            — if true, report only, no DB writes         (default false)
         *   includeMissed     — count MISSED days as infractions           (default true)
         *   includeLate       — count LATE days as infractions             (default true)
         */
        this.analyzeAttendanceDiscipline = async (req, res) => {
            try {
                const businessId = req.user.businessId;
                const windowDays = Number(req.body.windowDays ?? req.query.windowDays ?? 30);
                const lateThreshold = Number(req.body.lateThreshold ?? req.query.lateThreshold ?? 3);
                const dryRun = req.body.dryRun === true || req.body.dryRun === 'true'
                    || req.query.dryRun === 'true';
                const includeMissed = req.body.includeMissed !== false && req.body.includeMissed !== 'false';
                const includeLate = req.body.includeLate !== false && req.body.includeLate !== 'false';
                // ── 1. Compute date range ────────────────────────────────────────────
                const { Op } = require('sequelize');
                const settings = await models_1.db.BusinessAttendanceSettings.findOne({ where: { businessId } });
                if (!settings)
                    return (0, response_1.errorResponse)(res, 'Attendance settings not configured', 400);
                const tz = settings.timezone || 'UTC';
                const toYmd = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
                const today = new Date();
                const since = new Date(today);
                since.setDate(since.getDate() - windowDays);
                const startDate = toYmd(since);
                const endDate = toYmd(today);
                const periodLabel = `${startDate} to ${endDate}`;
                const analysisRunId = crypto_1.default.randomUUID();
                // ── 2. Use the HR attendance report service ──────────────────────────
                const { AttendanceHrService } = require('../attendanceHr/attendanceHr.service');
                const hrService = new AttendanceHrService();
                const reportData = await hrService.report(businessId, {
                    startDate, endDate,
                    departmentId: null, employeeId: null,
                    status: null, search: null,
                    sortBy: 'name', sortOrder: 'asc',
                });
                const rows = reportData.rows ?? [];
                const byEmployee = new Map();
                for (const row of rows) {
                    const isMissed = row.currentStatus === 'MISSED';
                    const isLate = row.currentStatus === 'LATE';
                    if ((!includeMissed && isMissed) || (!includeLate && isLate))
                        continue;
                    if (!isMissed && !isLate)
                        continue;
                    const uid = String(row.employeeId);
                    const emp = byEmployee.get(uid) ?? {
                        userId: uid,
                        fullName: row.employeeName ?? 'Unknown',
                        email: '',
                        dept: row.department?.name ?? 'Unknown',
                        missedDays: 0, lateDays: 0, totalLateMinutes: 0,
                        infractions: [],
                    };
                    if (isMissed)
                        emp.missedDays++;
                    if (isLate) {
                        emp.lateDays++;
                        emp.totalLateMinutes += Number(row.lateByMinutes || 0);
                    }
                    emp.infractions.push({ date: row.date, status: row.currentStatus, lateByMinutes: Number(row.lateByMinutes || 0) });
                    byEmployee.set(uid, emp);
                }
                // Enrich with emails from Users
                const userIds = Array.from(byEmployee.keys());
                if (userIds.length) {
                    const users = await models_1.db.User.findAll({ where: { id: { [Op.in]: userIds }, businessId }, attributes: ['id', 'email'] });
                    for (const u of users) {
                        const emp = byEmployee.get(String(u.id));
                        if (emp)
                            emp.email = u.email ?? '';
                    }
                }
                // ── 4. Build report + auto-action ────────────────────────────────────
                const report = [];
                const actioned = [];
                const skipped = [];
                for (const emp of byEmployee.values()) {
                    const totalInfractions = emp.missedDays + emp.lateDays;
                    // Severity score: each missed = 2pts, each late = 1pt, +1 per 30min late
                    const rawScore = (emp.missedDays * 2) + emp.lateDays + Math.floor(emp.totalLateMinutes / 30);
                    const severity = rawScore >= 10 ? 'critical' : rawScore >= 5 ? 'major' : 'minor';
                    const scoreDisp = `${Math.min(rawScore, 10).toFixed(1)}/10`;
                    const entry = {
                        userId: emp.userId,
                        fullName: emp.fullName,
                        email: emp.email,
                        department: emp.dept,
                        missedDays: emp.missedDays,
                        lateDays: emp.lateDays,
                        totalLateMinutes: emp.totalLateMinutes,
                        totalInfractions,
                        severity,
                        score: scoreDisp,
                        infractions: emp.infractions,
                        actionCreated: false,
                    };
                    if (totalInfractions >= lateThreshold) {
                        if (!dryRun) {
                            const existing = await models_1.db.DisciplinaryCase.findOne({
                                where: {
                                    businessId,
                                    employeeUserId: emp.userId,
                                    caseType: 'attendance',
                                    status: { [Op.notIn]: ['closed', 'resolved'] },
                                },
                            });
                            if (!existing) {
                                const parts = [];
                                if (emp.missedDays > 0)
                                    parts.push(`${emp.missedDays} missed day(s)`);
                                if (emp.lateDays > 0)
                                    parts.push(`${emp.lateDays} late day(s) (${emp.totalLateMinutes}min total)`);
                                const caseRecord = await models_1.db.DisciplinaryCase.create({
                                    businessId,
                                    employeeUserId: emp.userId,
                                    reportedByUserId: req.user.id,
                                    caseType: 'attendance',
                                    severity,
                                    title: `Attendance Issue: ${parts.join(' & ')} over ${windowDays} days`,
                                    description: `Automated analysis for ${periodLabel}: employee recorded ${parts.join(' and ')}. Total infraction score: ${scoreDisp}. This case was auto-generated by the attendance discipline analyzer.`,
                                    status: 'open',
                                    metadata: {
                                        score: parseFloat(scoreDisp),
                                        missedDays: emp.missedDays,
                                        lateDays: emp.lateDays,
                                        totalLateMinutes: emp.totalLateMinutes,
                                        period: periodLabel,
                                        analysisRunId,
                                        generatedAt: new Date().toISOString(),
                                        autoGenerated: true,
                                        notificationStatus: {
                                            employeesSentAt: null,
                                            managersSentAt: null,
                                        },
                                    },
                                });
                                await auditLog_service_1.AuditLogService.log('AUTO_DISCIPLINE_ATTENDANCE', 'hr_disciplinary_cases', String(caseRecord.id), null, { employeeUserId: emp.userId }, req);
                                // Notify the EMPLOYEE directly — not admins
                                try {
                                    const missedMsg = emp.missedDays > 0 ? `${emp.missedDays} missed check-in(s)` : '';
                                    const lateMsg = emp.lateDays > 0 ? `${emp.lateDays} late check-in(s)` : '';
                                    const detailMsg = [missedMsg, lateMsg].filter(Boolean).join(' and ');
                                    if (false)
                                        await notification_service_1.InternalNotifier.send({
                                            businessId,
                                            recipientUserId: emp.userId,
                                            senderUserId: req.user.id,
                                            moduleKey: 'hr',
                                            type: 'attendance_discipline_warning',
                                            title: 'Attendance Improvement Notice',
                                            message: `Dear ${emp.fullName}, our records show ${detailMsg} over the past ${windowDays} days. Please improve your attendance. A formal case has been opened — contact HR for support.`,
                                            entityType: 'DisciplinaryCase',
                                            entityId: String(caseRecord.id),
                                            priority: severity === 'critical' ? 'urgent' : severity === 'major' ? 'high' : 'normal',
                                        });
                                }
                                catch (notifErr) {
                                    console.error('[AttendanceAnalysis] Notification failed for', emp.userId, notifErr);
                                }
                                entry.actionCreated = true;
                                entry.caseId = caseRecord.id;
                                entry.analysisRunId = analysisRunId;
                                actioned.push(emp.fullName);
                            }
                            else {
                                entry.existingCaseId = existing.id;
                                skipped.push(emp.fullName);
                            }
                        }
                        else {
                            entry.wouldAction = true;
                        }
                    }
                    report.push(entry);
                }
                report.sort((a, b) => b.totalInfractions - a.totalInfractions);
                (0, response_1.successResponse)(res, {
                    windowDays, lateThreshold, dryRun, includeMissed, includeLate,
                    analysisRunId,
                    period: periodLabel,
                    totalEmployees: report.length,
                    actioned: actioned.length,
                    skipped: skipped.length,
                    actionedNames: actioned,
                    skippedNames: skipped,
                    report,
                }, dryRun
                    ? `Dry run: ${report.filter(r => r.wouldAction).length} employees would receive discipline cases.`
                    : `Analysis complete. ${actioned.length} new case(s) created for manager review. No notifications sent yet.`);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.sendAttendanceDisciplineAnalysis = async (req, res) => {
            try {
                const { Op } = require('sequelize');
                const businessId = req.user.businessId;
                const audience = req.body?.audience === 'managers' ? 'managers' : 'all';
                const analysisRunId = req.body?.analysisRunId ? String(req.body.analysisRunId) : '';
                const caseIds = Array.isArray(req.body?.caseIds) ? req.body.caseIds.filter(Boolean).map(String) : [];
                const metadataWhere = { autoGenerated: true };
                if (analysisRunId)
                    metadataWhere.analysisRunId = analysisRunId;
                const where = {
                    businessId,
                    caseType: 'attendance',
                    status: 'under_review',
                    metadata: { [Op.contains]: metadataWhere },
                };
                if (caseIds.length)
                    where.id = { [Op.in]: caseIds };
                const cases = await models_1.db.DisciplinaryCase.findAll({
                    where,
                    include: [{ model: models_1.db.User, as: 'employee', attributes: ['id', 'fullName', 'email'], required: false }],
                    order: [['createdAt', 'DESC']],
                });
                let managerIds = [];
                if (audience === 'managers') {
                    const managers = await models_1.db.User.findAll({
                        where: { businessId, status: 'active' },
                        include: [{
                                model: models_1.db.Role,
                                through: { attributes: [] },
                                where: { key: { [Op.in]: ['HR_MANAGER', 'BUSINESS_ADMIN'] } },
                                required: true,
                            }],
                        attributes: ['id'],
                    });
                    managerIds = Array.from(new Set(managers.map((u) => String(u.id))));
                }
                let sent = 0;
                for (const c of cases) {
                    const metadata = c.metadata || {};
                    const notificationStatus = metadata.notificationStatus || {};
                    const alreadySent = audience === 'managers' ? notificationStatus.managersSentAt : notificationStatus.employeesSentAt;
                    if (alreadySent)
                        continue;
                    const score = metadata.score ? `${metadata.score}/10` : c.severity;
                    const recipients = audience === 'managers' ? managerIds : [String(c.employeeUserId)];
                    for (const recipientUserId of recipients) {
                        await notification_service_1.InternalNotifier.send({
                            businessId,
                            recipientUserId,
                            senderUserId: req.user.id,
                            moduleKey: 'hr',
                            type: audience === 'managers' ? 'attendance_discipline_manager_review' : 'attendance_discipline_warning',
                            title: audience === 'managers' ? 'Attendance Discipline Review Ready' : 'Attendance Improvement Notice',
                            message: audience === 'managers'
                                ? `${c.employee?.fullName || 'An employee'} has an attendance discipline case ready for review. Severity score: ${score}.`
                                : `Dear ${c.employee?.fullName || 'Employee'}, HR has reviewed your attendance record and opened a discipline case. Severity score: ${score}. Please contact HR for support.`,
                            entityType: 'DisciplinaryCase',
                            entityId: String(c.id),
                            priority: c.severity === 'critical' ? 'urgent' : c.severity === 'major' ? 'high' : 'normal',
                            metadata: { audience, analysisRunId: metadata.analysisRunId || null },
                        });
                        sent += 1;
                    }
                    await c.update({
                        metadata: {
                            ...metadata,
                            notificationStatus: {
                                ...notificationStatus,
                                ...(audience === 'managers' ? { managersSentAt: new Date().toISOString() } : { employeesSentAt: new Date().toISOString() }),
                            },
                        },
                    });
                }
                await auditLog_service_1.AuditLogService.log('SENT_ATTENDANCE_DISCIPLINE_ANALYSIS', 'hr_disciplinary_cases', analysisRunId || 'all_open_generated', null, { audience, sent, caseCount: cases.length }, req);
                (0, response_1.successResponse)(res, { sent, caseCount: cases.length, audience }, `Sent ${sent} notification(s) to ${audience === 'managers' ? 'managers' : 'employees'}.`);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.resetAttendanceDisciplineAnalysis = async (req, res) => {
            try {
                const { Op } = require('sequelize');
                const businessId = req.user.businessId;
                const resetBatchId = crypto_1.default.randomUUID();
                const resetAt = new Date().toISOString();
                const cases = await models_1.db.DisciplinaryCase.findAll({
                    where: {
                        businessId,
                        caseType: 'attendance',
                        status: { [Op.notIn]: ['closed', 'resolved'] },
                        metadata: {
                            [Op.contains]: {
                                autoGenerated: true,
                            },
                        },
                    },
                });
                for (const c of cases) {
                    await c.update({
                        status: 'closed',
                        actionTaken: `Analysis reset archived this generated case on ${resetAt}.`,
                        metadata: {
                            ...(c.metadata || {}),
                            resetBatchId,
                            resetAt,
                            archivedByReset: true,
                        },
                    });
                }
                await auditLog_service_1.AuditLogService.log('RESET_ATTENDANCE_DISCIPLINE_ANALYSIS', 'hr_disciplinary_cases', resetBatchId, null, { archived: cases.length, resetBatchId, resetAt }, req);
                (0, response_1.successResponse)(res, { archived: cases.length, resetBatchId, resetAt }, `Attendance analysis reset. ${cases.length} generated case(s) archived with reset batch ${resetBatchId}.`);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listDisciplinaryCases = async (req, res) => {
            try {
                const businessId = req.user.businessId;
                const page = Number(req.query.page || 1);
                const size = Number(req.query.size || 50);
                const where = { businessId };
                if (req.query.status)
                    where.status = req.query.status;
                if (req.query.severity)
                    where.severity = req.query.severity;
                const { Op } = require('sequelize');
                const { count, rows } = await models_1.db.DisciplinaryCase.findAndCountAll({
                    where,
                    include: [
                        { model: models_1.db.User, as: 'employee', attributes: ['id', 'fullName', 'email'], required: false },
                        { model: models_1.db.User, as: 'reporter', attributes: ['id', 'fullName'], required: false },
                    ],
                    order: [['createdAt', 'DESC']],
                    limit: size,
                    offset: (page - 1) * size,
                });
                const employeeIds = Array.from(new Set(rows.map((r) => String(r.employeeUserId)).filter(Boolean)));
                const unavailableReasons = employeeIds.length ? await models_1.db.AttendanceRequest.findAll({
                    where: {
                        businessId,
                        employeeUserId: { [Op.in]: employeeIds },
                        requestType: 'not_available',
                        status: { [Op.in]: ['pending', 'approved'] },
                    },
                    order: [['createdAt', 'DESC']],
                    limit: 100,
                }) : [];
                const lateExplanations = employeeIds.length ? await models_1.db.AttendanceLateExplanation.findAll({
                    where: {
                        businessId,
                        employeeId: { [Op.in]: employeeIds },
                    },
                    include: [{ model: models_1.db.AttendanceLateReason, as: 'reason', attributes: ['id', 'name'] }],
                    order: [['createdAt', 'DESC']],
                    limit: 100,
                }) : [];
                const unavailableByEmployee = new Map();
                for (const item of unavailableReasons) {
                    const key = String(item.employeeUserId);
                    unavailableByEmployee.set(key, [...(unavailableByEmployee.get(key) || []), item]);
                }
                const lateByEmployee = new Map();
                for (const item of lateExplanations) {
                    const key = String(item.employeeId);
                    lateByEmployee.set(key, [...(lateByEmployee.get(key) || []), item]);
                }
                const enrichedRows = rows.map((row) => {
                    const plain = row.toJSON();
                    const key = String(plain.employeeUserId);
                    plain.attendanceReasons = {
                        unavailable: (unavailableByEmployee.get(key) || []).slice(0, 3).map((item) => ({
                            id: item.id,
                            title: item.title,
                            category: item.category,
                            reason: item.reason,
                            status: item.status,
                            fromAt: item.fromAt,
                            toAt: item.toAt,
                            createdAt: item.createdAt,
                        })),
                        late: (lateByEmployee.get(key) || []).slice(0, 3).map((item) => ({
                            id: item.id,
                            reasonName: item.reason?.name || null,
                            customReason: item.customReason || null,
                            lateByMinutes: item.lateByMinutes,
                            createdAt: item.createdAt,
                        })),
                    };
                    return plain;
                });
                (0, response_1.successResponse)(res, { rows: enrichedRows, total: count, page, totalPages: Math.ceil(count / size) });
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.createDisciplinaryCase = async (req, res) => {
            try {
                const { employeeUserId, caseType, severity, title, description, metadata } = req.body;
                if (!employeeUserId || !caseType || !title || !description) {
                    return (0, response_1.errorResponse)(res, 'employeeUserId, caseType, title and description are required', 400);
                }
                const r = await models_1.db.DisciplinaryCase.create({
                    businessId: req.user.businessId,
                    employeeUserId,
                    reportedByUserId: req.user.id,
                    caseType,
                    severity: severity || 'minor',
                    title,
                    description,
                    status: 'open',
                    metadata: metadata || {},
                });
                await auditLog_service_1.AuditLogService.log('CREATED_DISCIPLINARY_CASE', 'hr_disciplinary_cases', String(r.id), null, {}, req);
                (0, response_1.successResponse)(res, r, 'Disciplinary case created.', 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.updateDisciplinaryCase = async (req, res) => {
            try {
                const r = await models_1.db.DisciplinaryCase.findOne({ where: { id: req.params.id, businessId: req.user.businessId } });
                if (!r)
                    return (0, response_1.errorResponse)(res, 'Disciplinary case not found', 404);
                const allowed = ['status', 'actionTaken', 'severity', 'metadata'];
                const payload = {};
                for (const key of allowed)
                    if (req.body[key] !== undefined)
                        payload[key] = req.body[key];
                await r.update(payload);
                await auditLog_service_1.AuditLogService.log('UPDATED_DISCIPLINARY_CASE', 'hr_disciplinary_cases', String(r.id), null, payload, req);
                (0, response_1.successResponse)(res, r, 'Disciplinary case updated.');
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.projectDashboard = async (req, res) => {
            try {
                const data = await this.service.getProjectPerformanceDashboard(req.user.businessId, req.query);
                (0, response_1.successResponse)(res, data);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.overview = async (req, res) => {
            try {
                const data = await this.service.getPerformanceOverview(req.user.businessId, req.query);
                (0, response_1.successResponse)(res, data);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listReviews = async (req, res) => {
            try {
                const data = await this.service.listPerformanceReviews(req.user.businessId, req.query);
                (0, response_1.successResponse)(res, data);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.employeeEvaluationEvidence = async (req, res) => {
            try {
                const data = await this.service.getEmployeeEvaluationEvidence(req.user.businessId, req.params.employeeUserId, req.query);
                (0, response_1.successResponse)(res, data);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === 'Employee not found' ? 404 : 400);
            }
        };
        this.attachProjectEvidenceToReview = async (req, res) => {
            try {
                const review = await this.service.attachProjectEvidenceToReview(req.user.businessId, req.params.reviewId);
                (0, response_1.successResponse)(res, review, 'Project evidence attached to review.');
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === 'Performance review not found' ? 404 : 400);
            }
        };
        // Disciplinary
        this.listDisciplinary = async (req, res) => {
            try {
                await this.service.restrictDisciplinaryAccess(req.user.businessId, req.user);
                const limit = Number(req.query.limit || 20);
                const offset = Number(req.query.offset || 0);
                const result = await models_1.db.DisciplinaryCase.findAndCountAll({ where: { businessId: req.user.businessId }, limit, offset });
                (0, response_1.paginationResponse)(res, result.rows, result.count, offset / limit + 1, limit);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, 403);
            }
        };
        // ── Exit Workflow ─────────────────────────────────────────────────────────
        // GET /hr/exit — list all exit processes (HR admin view)
        this.listExitProcesses = async (req, res) => {
            try {
                const businessId = req.user.businessId;
                const limit = Number(req.query.limit || 50);
                const offset = Number(req.query.offset || 0);
                const status = req.query.status;
                const where = { businessId };
                if (status)
                    where.status = status;
                const result = await models_1.db.ExitProcess.findAndCountAll({
                    where,
                    limit,
                    offset,
                    order: [['createdAt', 'DESC']],
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
                                        { model: models_1.db.Position, as: 'position', attributes: ['id', 'title'] },
                                    ],
                                }],
                        },
                        {
                            model: models_1.db.User,
                            as: 'initiator',
                            attributes: ['id', 'fullName', 'email'],
                        },
                        {
                            model: models_1.db.User,
                            as: 'reviewer',
                            attributes: ['id', 'fullName', 'email'],
                        },
                    ],
                });
                (0, response_1.successResponse)(res, { rows: result.rows, count: result.count });
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listExitForms = async (req, res) => {
            try {
                await this.service.provisionForms(req.user.businessId);
                const forms = await models_1.db.FormDefinition.findAll({
                    where: { businessId: req.user.businessId, moduleKey: 'hr', key: ['employee_resignation', 'exit_interview', 'offboarding_checklist', 'asset_return_clearance', 'experience_letter'] },
                    include: [{ model: models_1.db.FormSubmission, attributes: ['id'], required: false }],
                    order: [['updatedAt', 'DESC']],
                });
                (0, response_1.successResponse)(res, forms.map((form) => ({
                    ...form.toJSON(),
                    usageCount: form.FormSubmissions?.length || form.FormSubmissions?.length === 0 ? form.FormSubmissions.length : 0,
                    version: form.settings?.version || 1,
                    category: form.settings?.category || 'exit',
                })));
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.createExitForm = async (req, res) => {
            try {
                const form = await models_1.db.FormDefinition.create({
                    businessId: req.user.businessId,
                    moduleKey: 'hr',
                    name: req.body.name,
                    key: req.body.key || String(req.body.name || 'exit_form').toLowerCase().replace(/\s+/g, '_'),
                    description: req.body.description || null,
                    status: req.body.status || 'active',
                    settings: { ...(req.body.settings || {}), category: 'exit', version: req.body.version || 1 },
                });
                (0, response_1.successResponse)(res, form, 'Exit form created.', 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.updateExitForm = async (req, res) => {
            try {
                const form = await models_1.db.FormDefinition.findOne({ where: { id: req.params.id, businessId: req.user.businessId, moduleKey: 'hr' } });
                if (!form)
                    return (0, response_1.errorResponse)(res, 'Form not found', 404);
                const settings = { ...(form.settings || {}), ...(req.body.settings || {}) };
                if (req.body.version !== undefined)
                    settings.version = req.body.version;
                if (!settings.category)
                    settings.category = 'exit';
                await form.update({
                    name: req.body.name ?? form.name,
                    description: req.body.description ?? form.description,
                    status: req.body.status ?? form.status,
                    settings,
                });
                (0, response_1.successResponse)(res, form, 'Exit form updated.');
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.deleteExitForm = async (req, res) => {
            try {
                const form = await models_1.db.FormDefinition.findOne({ where: { id: req.params.id, businessId: req.user.businessId, moduleKey: 'hr' } });
                if (!form)
                    return (0, response_1.errorResponse)(res, 'Form not found', 404);
                await form.destroy();
                (0, response_1.successResponse)(res, null, 'Exit form deleted.');
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.downloadExitForm = async (req, res) => {
            try {
                const form = await models_1.db.FormDefinition.findOne({ where: { id: req.params.id, businessId: req.user.businessId, moduleKey: 'hr' } });
                if (!form)
                    return (0, response_1.errorResponse)(res, 'Form not found', 404);
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', `attachment; filename="${form.key}.json"`);
                res.send(JSON.stringify(form.toJSON(), null, 2));
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.getExitAnalytics = async (req, res) => {
            try {
                const data = await this.service.getExitAnalytics(req.user.businessId, req.query);
                (0, response_1.successResponse)(res, data);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        // GET /hr/exit/me - current employee's latest exit request
        this.getMyExitProcess = async (req, res) => {
            try {
                const result = await models_1.db.ExitProcess.findOne({
                    where: {
                        businessId: req.user.businessId,
                        employeeUserId: req.user.id,
                    },
                    order: [['createdAt', 'DESC']],
                    include: [
                        {
                            model: models_1.db.User,
                            as: 'employee',
                            attributes: ['id', 'fullName', 'email'],
                        },
                        {
                            model: models_1.db.User,
                            as: 'initiator',
                            attributes: ['id', 'fullName', 'email'],
                        },
                    ],
                });
                if (!result)
                    return (0, response_1.successResponse)(res, result);
                const scheduledInterview = await models_1.db.ExitInterview.findOne({
                    where: {
                        businessId: req.user.businessId,
                        exitProcessId: result.id,
                        status: 'scheduled',
                    },
                    include: [{ model: models_1.db.User, as: 'interviewer', attributes: ['id', 'fullName', 'email'] }],
                    order: [['scheduledAt', 'ASC']],
                });
                (0, response_1.successResponse)(res, { ...result.toJSON(), scheduledInterview: scheduledInterview ? scheduledInterview.toJSON() : null });
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        // GET /hr/exit/:id - tenant-scoped exit request detail
        this.getExitProcess = async (req, res) => {
            try {
                const result = await models_1.db.ExitProcess.findOne({
                    where: {
                        id: req.params.id,
                        businessId: req.user.businessId,
                    },
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
                                        { model: models_1.db.Position, as: 'position', attributes: ['id', 'title'] },
                                    ],
                                }],
                        },
                        {
                            model: models_1.db.User,
                            as: 'initiator',
                            attributes: ['id', 'fullName', 'email'],
                        },
                    ],
                });
                if (!result)
                    return (0, response_1.errorResponse)(res, 'Exit process not found', 404);
                (0, response_1.successResponse)(res, result);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        // POST /hr/exit/resign — employee submits offboarding request with rich text letter
        this.submitResignation = async (req, res) => {
            try {
                const { effectiveDate, reason, letterHtml, templateId, templateSnapshot, formValues } = req.body;
                const businessId = req.user.businessId;
                if (!effectiveDate) {
                    return (0, response_1.errorResponse)(res, 'effectiveDate is required', 400);
                }
                let wasRevision = false;
                const ex = await models_1.db.sequelize.transaction(async (transaction) => {
                    const existing = await models_1.db.ExitProcess.findOne({
                        where: {
                            businessId,
                            employeeUserId: req.user.id,
                        },
                        order: [['createdAt', 'DESC']],
                        transaction,
                        lock: true,
                    });
                    if (existing && existing.status !== 'cancelled') {
                        throw new Error('You already have an active offboarding request.');
                    }
                    wasRevision = Boolean(existing);
                    const payload = {
                        initiatedByUserId: req.user.id,
                        employeeUserId: req.user.id,
                        exitType: 'resignation',
                        effectiveDate,
                        reason: reason || null,
                        status: 'pending',
                        reviewedByUserId: null,
                        reviewedAt: null,
                        approvalNote: null,
                        rejectionReason: null,
                        clearanceData: {
                            ...(existing?.clearanceData || {}),
                            letterHtml: letterHtml || null,
                            noticePeriodDays: 30,
                            templateId: templateId || null,
                            templateSnapshot: templateSnapshot || null,
                            formValues: formValues || {},
                        },
                    };
                    const exitProcess = existing
                        ? await existing.update(payload, { transaction })
                        : await models_1.db.ExitProcess.create({ businessId, ...payload }, { transaction });
                    await this.service.seedExitClearanceSteps(businessId, String(exitProcess.id), transaction);
                    await this.service.seedExitDocuments(businessId, String(exitProcess.id), transaction);
                    return exitProcess;
                });
                await auditLog_service_1.AuditLogService.log('SUBMIT_RESIGNATION', 'hr_exit_processes', String(ex.id), null, {}, req);
                await this.logExitEvent(req, String(ex.id), wasRevision ? 'EXIT_REQUEST_REVISED' : 'EXIT_RESIGNATION_SUBMITTED', { status: ex.status });
                // Notify all HR managers and business admins
                try {
                    const adminUsers = await models_1.db.User.findAll({
                        where: { businessId, status: 'active' },
                        include: [{
                                model: models_1.db.Role,
                                through: { attributes: [] },
                                where: { key: ['BUSINESS_ADMIN', 'HR_MANAGER'] },
                                required: true,
                            }],
                        attributes: ['id'],
                    });
                    const adminIds = adminUsers
                        .map((u) => u.id)
                        .filter((id) => id !== req.user.id);
                    if (adminIds.length > 0) {
                        const employee = await models_1.db.User.findByPk(req.user.id, { attributes: ['fullName'] });
                        await notification_service_1.InternalNotifier.sendBulk({
                            businessId,
                            recipientUserIds: adminIds,
                            senderUserId: req.user.id,
                            moduleKey: 'hr',
                            type: 'exit_submitted',
                            title: 'New Offboarding Request',
                            message: `${employee?.fullName || 'An employee'} has submitted an offboarding/resignation request. Last working day: ${new Date(effectiveDate).toLocaleDateString()}.`,
                            entityType: 'ExitProcess',
                            entityId: String(ex.id),
                            priority: 'high',
                        });
                    }
                }
                catch (notifErr) {
                    console.error('[ExitProcess] Failed to send admin notifications:', notifErr);
                }
                (0, response_1.successResponse)(res, ex, 'Offboarding request submitted successfully.', 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === 'You already have an active offboarding request.' ? 400 : 500);
            }
        };
        this.updateExitStatus = async (req, res) => {
            try {
                const before = await models_1.db.ExitProcess.findOne({ where: { id: req.params.id, businessId: req.user.businessId } });
                const result = await this.service.processExit(req.user.businessId, req.params.id, req.body.status, {
                    reviewedByUserId: req.user.id,
                    effectiveDate: req.body.effectiveDate || req.body.confirmedLastWorkingDate,
                    approvalNote: req.body.approvalNote,
                    rejectionReason: req.body.rejectionReason || req.body.reason,
                });
                await auditLog_service_1.AuditLogService.log('UPDATED_EXIT_PROCESS', 'hr_exit_processes', String(result.id), null, { status: req.body.status }, req);
                await this.logExitEvent(req, String(result.id), req.body.status === 'in_progress'
                    ? 'EXIT_APPROVED'
                    : req.body.status === 'interview_scheduled'
                        ? 'EXIT_INTERVIEW_SCHEDULED'
                        : req.body.status === 'rejected'
                            ? 'EXIT_REJECTED'
                            : req.body.status === 'cancelled' && before?.status === 'pending'
                                ? 'EXIT_REVISION_REQUESTED'
                                : req.body.status === 'cancelled'
                                    ? 'EXIT_PROCESS_CANCELLED'
                                    : req.body.status === 'completed'
                                        ? 'EXIT_PROCESS_COMPLETED'
                                        : 'EXIT_STATUS_UPDATED', { fromStatus: before?.status, status: req.body.status, approvalNote: req.body.approvalNote, rejectionReason: req.body.rejectionReason || req.body.reason });
                (0, response_1.successResponse)(res, result);
            }
            catch (e) {
                const statusCode = e.message === 'Exit process not found.' ? 404 : 400;
                (0, response_1.errorResponse)(res, e.message, statusCode);
            }
        };
        this.approveExitRequest = async (req, res) => {
            req.body.status = 'in_progress';
            return this.updateExitStatus(req, res);
        };
        this.sendOffboardingForm = async (req, res) => {
            try {
                const result = await this.service.sendOffboardingForm(req.user.businessId, req.params.id, req.user.id);
                const deviceCount = Array.isArray(result.offboardingFormData?.acceptedDevices) ? result.offboardingFormData.acceptedDevices.length : 0;
                await notification_service_1.InternalNotifier.send({
                    businessId: req.user.businessId,
                    recipientUserId: result.employeeUserId,
                    senderUserId: req.user.id,
                    moduleKey: 'hr',
                    type: 'offboarding_form_ready',
                    title: 'Offboarding Form Ready',
                    message: `HR has sent your offboarding form. Please review and submit it${deviceCount > 0 ? `, including confirmation for ${deviceCount} assigned item(s)` : ''}.`,
                    entityType: 'ExitProcess',
                    entityId: String(result.id),
                    priority: 'high',
                    metadata: {
                        exitProcessId: result.id,
                        offboardingFormSentAt: result.offboardingFormSentAt,
                        acceptedDevices: result.offboardingFormData?.acceptedDevices || [],
                    },
                });
                await this.logExitEvent(req, String(result.id), 'EXIT_OFFBOARDING_FORM_SENT', { employeeUserId: result.employeeUserId });
                (0, response_1.successResponse)(res, result, 'Offboarding form sent and employee notified.');
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === 'Exit process not found.' ? 404 : 400);
            }
        };
        this.submitOffboardingForm = async (req, res) => {
            try {
                const result = await this.service.submitOffboardingForm(req.user.businessId, req.params.id, req.user.id, req.body || {});
                await this.logExitEvent(req, String(result.id), 'EXIT_OFFBOARDING_FORM_SUBMITTED', { employeeUserId: result.employeeUserId });
                (0, response_1.successResponse)(res, result, 'Offboarding form submitted.');
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === 'Exit process not found.' ? 404 : 400);
            }
        };
        this.rejectExitRequest = async (req, res) => {
            if (!req.body.rejectionReason && !req.body.reason)
                return (0, response_1.errorResponse)(res, 'rejectionReason is required', 400);
            req.body.status = 'rejected';
            return this.updateExitStatus(req, res);
        };
        this.disableExitAccount = async (req, res) => {
            try {
                const result = await this.service.disableOffboardingAccount(req.user.businessId, req.params.id, req.user.id);
                await this.logExitEvent(req, String(result.id), 'EXIT_ACCOUNT_DISABLED', { employeeUserId: result.employeeUserId });
                (0, response_1.successResponse)(res, result, 'Employee account disabled and historical records preserved.');
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === 'Exit process not found.' ? 404 : 400);
            }
        };
        this.updateExitFinalPay = async (req, res) => {
            try {
                const result = await this.service.updateFinalPay(req.user.businessId, req.params.id, req.user.id, req.body || {});
                await auditLog_service_1.AuditLogService.log('UPDATED_EXIT_FINAL_PAY', 'hr_exit_processes', String(result.id), null, result.finalPayData, req);
                if (result.finalPayData?.status === 'settled')
                    await this.logExitEvent(req, String(result.id), 'EXIT_FINAL_PAYMENT_SETTLED', result.finalPayData);
                (0, response_1.successResponse)(res, result, 'Final pay updated.');
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === 'Exit process not found.' ? 404 : 400);
            }
        };
        this.createExitProcess = async (req, res) => {
            try {
                const { employeeUserId, exitType, effectiveDate, reason } = req.body;
                if (!employeeUserId || !effectiveDate)
                    return (0, response_1.errorResponse)(res, 'employeeUserId and effectiveDate are required', 400);
                if (!['termination', 'redundancy'].includes(exitType))
                    return (0, response_1.errorResponse)(res, 'Only termination or redundancy can be HR initiated', 400);
                const ex = await models_1.db.sequelize.transaction(async (transaction) => {
                    const exitProcess = await models_1.db.ExitProcess.create({
                        businessId: req.user.businessId,
                        employeeUserId,
                        initiatedByUserId: req.user.id,
                        exitType,
                        reason: reason || null,
                        effectiveDate,
                        status: 'pending',
                        clearanceData: {},
                        finalPayData: { status: 'pending' },
                    }, { transaction });
                    await this.service.seedExitClearanceSteps(req.user.businessId, String(exitProcess.id), transaction);
                    await this.service.seedExitDocuments(req.user.businessId, String(exitProcess.id), transaction);
                    return exitProcess;
                });
                await this.logExitEvent(req, String(ex.id), 'EXIT_HR_INITIATED', { exitType });
                (0, response_1.successResponse)(res, ex, 'Exit process initiated.', 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.updateExitProcess = async (req, res) => {
            try {
                const ex = await models_1.db.ExitProcess.findOne({ where: { id: req.params.id, businessId: req.user.businessId } });
                if (!ex)
                    return (0, response_1.errorResponse)(res, 'Exit process not found', 404);
                const allowed = {};
                for (const key of ['reason', 'effectiveDate', 'clearanceData'])
                    if (req.body[key] !== undefined)
                        allowed[key] = req.body[key];
                await ex.update(allowed);
                await this.logExitEvent(req, String(ex.id), 'EXIT_PROCESS_UPDATED', allowed);
                (0, response_1.successResponse)(res, ex, 'Exit process updated.');
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.getExitTimeline = async (req, res) => {
            try {
                const exitProcess = await models_1.db.ExitProcess.findOne({ where: { id: req.params.id, businessId: req.user.businessId } });
                if (!exitProcess)
                    return (0, response_1.errorResponse)(res, 'Exit process not found', 404);
                const canReadAll = this.hasPermission(req, 'hr.read') || this.hasPermission(req, 'hr.write');
                const canReadOwn = this.hasPermission(req, 'exit.self') && exitProcess.employeeUserId === req.user.id;
                if (!canReadAll && !canReadOwn)
                    return (0, response_1.errorResponse)(res, 'Forbidden', 403);
                const events = await models_1.db.AuditLog.findAll({
                    where: { businessId: req.user.businessId, entityType: 'ExitProcess', entityId: req.params.id },
                    include: [{ model: models_1.db.User, attributes: ['id', 'fullName', 'email'] }],
                    order: [['createdAt', 'ASC']],
                });
                (0, response_1.successResponse)(res, events);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listExitClearance = async (req, res) => {
            try {
                const exitProcess = await this.service.getExitWithClearance(req.user.businessId, req.params.id);
                if (!exitProcess)
                    return (0, response_1.errorResponse)(res, 'Exit process not found', 404);
                const canReadAll = this.hasPermission(req, 'hr.write');
                const canReadOwn = this.hasPermission(req, 'exit.self') && exitProcess.employeeUserId === req.user.id;
                if (!canReadAll && !canReadOwn)
                    return (0, response_1.errorResponse)(res, 'Forbidden', 403);
                await this.service.seedExitClearanceSteps(req.user.businessId, req.params.id);
                const refreshed = await this.service.getExitWithClearance(req.user.businessId, req.params.id);
                (0, response_1.successResponse)(res, refreshed);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.completeExitClearanceStep = async (req, res) => {
            try {
                const step = await this.service.updateClearanceStep(req.user.businessId, req.params.id, req.params.stepId, { status: 'completed', notes: req.body?.notes }, req.user.id);
                await this.logExitEvent(req, req.params.id, 'EXIT_CLEARANCE_STEP_COMPLETED', { stepId: req.params.stepId });
                (0, response_1.successResponse)(res, step, 'Clearance step completed.');
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message.includes('not found') ? 404 : 400);
            }
        };
        this.waiveExitClearanceStep = async (req, res) => {
            try {
                const step = await this.service.updateClearanceStep(req.user.businessId, req.params.id, req.params.stepId, { status: 'waived', notes: req.body?.notes }, req.user.id);
                await this.logExitEvent(req, req.params.id, 'EXIT_CLEARANCE_STEP_WAIVED', { stepId: req.params.stepId });
                (0, response_1.successResponse)(res, step, 'Clearance step waived.');
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message.includes('not found') ? 404 : 400);
            }
        };
        this.updateExitClearanceStep = async (req, res) => {
            try {
                const step = await this.service.updateClearanceStep(req.user.businessId, req.params.id, req.params.stepId, req.body || {}, req.user.id);
                (0, response_1.successResponse)(res, step, 'Clearance step updated.');
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message.includes('not found') ? 404 : 400);
            }
        };
        this.listExitInterviews = async (req, res) => {
            try {
                const interviews = await models_1.db.ExitInterview.findAll({
                    where: { businessId: req.user.businessId },
                    include: [
                        ...this.service.exitProcessInclude(),
                        { model: models_1.db.User, as: 'interviewer', attributes: ['id', 'fullName', 'email'] },
                    ],
                    order: [['scheduledAt', 'ASC']],
                });
                (0, response_1.successResponse)(res, interviews);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.createExitInterview = async (req, res) => {
            try {
                const exitProcess = await models_1.db.ExitProcess.findOne({ where: { id: req.params.id, businessId: req.user.businessId } });
                if (!exitProcess)
                    return (0, response_1.errorResponse)(res, 'Exit process not found', 404);
                const interview = await models_1.db.ExitInterview.create({
                    businessId: req.user.businessId,
                    exitProcessId: req.params.id,
                    title: req.body.title || 'Exit Interview',
                    scheduledAt: req.body.scheduledAt || (req.body.interviewDate ? new Date(`${req.body.interviewDate}T${req.body.startTime || '09:00'}:00`) : new Date()),
                    startTime: req.body.startTime || null,
                    endTime: req.body.endTime || null,
                    interviewType: req.body.interviewType || 'in-person',
                    location: req.body.location || null,
                    meetingUrl: req.body.meetingUrl || null,
                    interviewerUserId: req.body.interviewerUserId || req.user.id,
                    panel: req.body.panel || [],
                    status: 'scheduled',
                });
                await exitProcess.update({ status: 'interview_scheduled' });
                await this.logExitEvent(req, req.params.id, 'EXIT_INTERVIEW_SCHEDULED', { interviewId: interview.id, scheduledAt: interview.scheduledAt });
                (0, response_1.successResponse)(res, interview, 'Exit interview scheduled.', 201);
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.updateExitInterview = async (req, res) => {
            try {
                const interview = await models_1.db.ExitInterview.findOne({ where: { id: req.params.interviewId, businessId: req.user.businessId } });
                if (!interview)
                    return (0, response_1.errorResponse)(res, 'Exit interview not found', 404);
                const allowed = [
                    'title', 'scheduledAt', 'startTime', 'endTime', 'interviewType', 'location', 'meetingUrl', 'interviewerUserId', 'panel', 'status', 'rating',
                    'reasonForLeaving', 'satisfactionScore', 'managementFeedback', 'workEnvironmentFeedback',
                    'careerDevelopmentFeedback', 'suggestions', 'employeeConcerns', 'rehireEligibility', 'handoverNotes', 'finalRecommendation', 'wouldRecommendCompany', 'remarks'
                ];
                const payload = {};
                for (const key of allowed)
                    if (req.body[key] !== undefined)
                        payload[key] = req.body[key];
                if (payload.status && !['scheduled', 'completed', 'cancelled'].includes(payload.status))
                    return (0, response_1.errorResponse)(res, 'Invalid interview status', 400);
                const updated = await interview.update(payload);
                (0, response_1.successResponse)(res, updated, 'Exit interview updated.');
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.completeExitInterview = async (req, res) => {
            try {
                const result = await models_1.db.sequelize.transaction(async (transaction) => {
                    const interview = await models_1.db.ExitInterview.findOne({
                        where: { id: req.params.interviewId, businessId: req.user.businessId },
                        transaction,
                        lock: true,
                    });
                    if (!interview)
                        throw new Error('Exit interview not found');
                    const payload = {
                        status: 'completed',
                        completedAt: new Date(),
                        rating: req.body.rating ?? interview.rating,
                        reasonForLeaving: req.body.reasonForLeaving ?? interview.reasonForLeaving,
                        satisfactionScore: req.body.satisfactionScore ?? interview.satisfactionScore,
                        managementFeedback: req.body.managementFeedback ?? interview.managementFeedback,
                        workEnvironmentFeedback: req.body.workEnvironmentFeedback ?? interview.workEnvironmentFeedback,
                        careerDevelopmentFeedback: req.body.careerDevelopmentFeedback ?? interview.careerDevelopmentFeedback,
                        suggestions: req.body.suggestions ?? interview.suggestions,
                        employeeConcerns: req.body.employeeConcerns ?? interview.employeeConcerns,
                        rehireEligibility: req.body.rehireEligibility ?? interview.rehireEligibility,
                        handoverNotes: req.body.handoverNotes ?? interview.handoverNotes,
                        finalRecommendation: req.body.finalRecommendation ?? interview.finalRecommendation,
                        wouldRecommendCompany: req.body.wouldRecommendCompany ?? interview.wouldRecommendCompany,
                        remarks: req.body.remarks ?? interview.remarks,
                    };
                    const updated = await interview.update(payload, { transaction });
                    const exitProcess = await models_1.db.ExitProcess.findOne({ where: { id: interview.exitProcessId, businessId: req.user.businessId }, transaction, lock: true });
                    if (exitProcess && !['in_progress', 'completed', 'account_disabled'].includes(String(exitProcess.status))) {
                        await exitProcess.update({ status: 'interview_completed' }, { transaction });
                    }
                    await this.service.completeClearanceStepByKey(req.user.businessId, interview.exitProcessId, 'exit_interview_completed', req.user.id, transaction);
                    await this.logExitEvent(req, String(interview.exitProcessId), 'EXIT_INTERVIEW_COMPLETED', { interviewId: interview.id });
                    return updated;
                });
                (0, response_1.successResponse)(res, result, 'Exit interview completed.');
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message, e.message === 'Exit interview not found' ? 404 : 400);
            }
        };
        this.sendExitInterviewReminder = async (req, res) => {
            try {
                const interview = await models_1.db.ExitInterview.findOne({
                    where: { id: req.params.interviewId, businessId: req.user.businessId },
                    include: this.service.exitProcessInclude(),
                });
                if (!interview)
                    return (0, response_1.errorResponse)(res, 'Exit interview not found', 404);
                const exitProcess = interview.exitProcess;
                const employeeUserId = exitProcess?.employeeUserId;
                if (!employeeUserId)
                    return (0, response_1.errorResponse)(res, 'Exit interview employee not found', 400);
                const scheduledAt = interview.scheduledAt ? new Date(interview.scheduledAt) : null;
                const dateLabel = scheduledAt ? scheduledAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'the scheduled date';
                const timeLabel = interview.startTime || (scheduledAt ? scheduledAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'the scheduled time');
                const placeLabel = interview.interviewType === 'in-person'
                    ? (interview.location || 'the location HR shared')
                    : (interview.meetingUrl || 'the meeting details HR shared');
                await notification_service_1.InternalNotifier.send({
                    businessId: req.user.businessId,
                    recipientUserId: employeeUserId,
                    senderUserId: req.user.id,
                    moduleKey: 'hr',
                    type: 'exit_interview_reminder',
                    title: 'Exit Interview Reminder',
                    message: `Reminder: your exit interview is scheduled for ${dateLabel} at ${timeLabel}. ${interview.interviewType === 'in-person' ? 'Location' : 'Meeting details'}: ${placeLabel}.`,
                    entityType: 'ExitInterview',
                    entityId: String(interview.id),
                    priority: 'high',
                    metadata: {
                        exitProcessId: interview.exitProcessId,
                        scheduledAt: interview.scheduledAt,
                        startTime: interview.startTime,
                        interviewType: interview.interviewType,
                        location: interview.location,
                        meetingUrl: interview.meetingUrl,
                    },
                });
                (0, response_1.successResponse)(res, interview, 'Exit interview reminder notification sent.');
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.listExitDocuments = async (req, res) => {
            try {
                const exitProcess = await models_1.db.ExitProcess.findOne({ where: { id: req.params.id, businessId: req.user.businessId } });
                if (!exitProcess)
                    return (0, response_1.errorResponse)(res, 'Exit process not found', 404);
                const canReadAll = this.hasPermission(req, 'hr.read') || this.hasPermission(req, 'hr.write');
                const canReadOwn = this.hasPermission(req, 'exit.self') && exitProcess.employeeUserId === req.user.id;
                if (!canReadAll && !canReadOwn)
                    return (0, response_1.errorResponse)(res, 'Forbidden', 403);
                await this.service.seedExitDocuments(req.user.businessId, req.params.id);
                const documents = await models_1.db.ExitDocument.findAll({
                    where: { businessId: req.user.businessId, exitProcessId: req.params.id },
                    include: [
                        { model: models_1.db.User, as: 'uploadedBy', attributes: ['id', 'fullName', 'email'] },
                        { model: models_1.db.User, as: 'verifiedBy', attributes: ['id', 'fullName', 'email'] },
                    ],
                    order: [['createdAt', 'ASC']],
                });
                (0, response_1.successResponse)(res, { exitProcess, documents });
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.uploadExitDocument = async (req, res) => {
            try {
                const doc = await models_1.db.ExitDocument.findOne({ where: { id: req.params.documentId, exitProcessId: req.params.id, businessId: req.user.businessId } });
                if (!doc)
                    return (0, response_1.errorResponse)(res, 'Exit document not found', 404);
                if (!req.file)
                    return (0, response_1.errorResponse)(res, 'No file uploaded', 400);
                const asset = await this.fileService.saveAssetRecord(req.user.businessId, req.user.id, req.file, {
                    moduleKey: 'hr',
                    entityType: 'ExitDocument',
                    entityId: String(doc.id),
                });
                const fileUrl = `/api/files/${asset.id}/download`;
                const updated = await doc.update({
                    status: 'uploaded',
                    fileUrl,
                    uploadedAt: new Date(),
                    uploadedByUserId: req.user.id,
                });
                await this.logExitEvent(req, req.params.id, 'EXIT_DOCUMENT_UPLOADED', { documentId: doc.id, documentKey: doc.documentKey });
                (0, response_1.successResponse)(res, updated, 'Exit document uploaded.');
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.verifyExitDocument = async (req, res) => {
            try {
                const doc = await models_1.db.ExitDocument.findOne({ where: { id: req.params.documentId, exitProcessId: req.params.id, businessId: req.user.businessId } });
                if (!doc)
                    return (0, response_1.errorResponse)(res, 'Exit document not found', 404);
                const updated = await doc.update({ status: 'verified', verifiedAt: new Date(), verifiedByUserId: req.user.id });
                await this.logExitEvent(req, req.params.id, 'EXIT_DOCUMENT_VERIFIED', { documentId: doc.id, documentKey: doc.documentKey });
                (0, response_1.successResponse)(res, updated, 'Exit document verified.');
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.updateExitDocument = async (req, res) => {
            try {
                const doc = await models_1.db.ExitDocument.findOne({ where: { id: req.params.documentId, exitProcessId: req.params.id, businessId: req.user.businessId } });
                if (!doc)
                    return (0, response_1.errorResponse)(res, 'Exit document not found', 404);
                const payload = {};
                for (const key of ['title', 'required', 'status', 'notes'])
                    if (req.body[key] !== undefined)
                        payload[key] = req.body[key];
                if (payload.status && !['missing', 'uploaded', 'verified', 'waived'].includes(payload.status))
                    return (0, response_1.errorResponse)(res, 'Invalid document status', 400);
                const updated = await doc.update(payload);
                (0, response_1.successResponse)(res, updated, 'Exit document updated.');
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
        this.downloadExitDocuments = async (req, res) => {
            try {
                const exitProcess = await models_1.db.ExitProcess.findOne({ where: { id: req.params.id, businessId: req.user.businessId } });
                if (!exitProcess)
                    return (0, response_1.errorResponse)(res, 'Exit process not found', 404);
                const canReadAll = this.hasPermission(req, 'hr.read') || this.hasPermission(req, 'hr.write');
                const canReadOwn = this.hasPermission(req, 'exit.self') && exitProcess.employeeUserId === req.user.id;
                if (!canReadAll && !canReadOwn)
                    return (0, response_1.errorResponse)(res, 'Forbidden', 403);
                const docs = await models_1.db.ExitDocument.findAll({
                    where: { businessId: req.user.businessId, exitProcessId: req.params.id },
                    order: [['createdAt', 'ASC']],
                });
                (0, response_1.successResponse)(res, { documents: docs.filter((doc) => doc.fileUrl).map((doc) => ({ id: doc.id, title: doc.title, fileUrl: doc.fileUrl })) }, 'Exit document downloads ready.');
            }
            catch (e) {
                (0, response_1.errorResponse)(res, e.message);
            }
        };
    }
    hasPermission(req, permission) {
        return Boolean(req.user?.isPlatformSuperAdmin || req.user?.permissions?.includes(permission));
    }
    logExitEvent(req, exitProcessId, action, data = {}) {
        return auditLog_service_1.AuditLogService.log(action, 'ExitProcess', exitProcessId, null, data, req);
    }
}
exports.HRPerformanceController = HRPerformanceController;
