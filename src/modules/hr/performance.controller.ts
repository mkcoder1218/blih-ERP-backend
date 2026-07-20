
import type { Request, Response } from 'express';
import { HRPerformanceService } from './performance.service';
import { errorResponse, successResponse, paginationResponse } from '../../utils/response';
import { AuditLogService } from "../../services/auditLog.service";
import { db } from '../../models';
import { InternalNotifier } from '../notification/notification.service';
import { FileService } from '../file/file.service';
import crypto from 'crypto';
import { ExitWorkflowService } from "./exit/exitWorkflow.service";
export class HRPerformanceController {
   private service = new HRPerformanceService();
   private exitWorkflowService =
     new ExitWorkflowService();
   private fileService = new FileService();

   private hasPermission(req: Request, permission: string) {
       return Boolean(req.user?.isPlatformSuperAdmin || req.user?.permissions?.includes(permission));
   }

   private logExitEvent(req: Request, exitProcessId: string, action: string, data: any = {}) {
       return AuditLogService.log(action, 'ExitProcess', exitProcessId, null, data, req);
   }

   seedForms = async (req: Request, res: Response) => {
     await this.service.provisionForms(req.user!.businessId);
     successResponse(res, null, "Performance and Exit templates seeded.");
   };

   // Training
   createTrainingRequest = async (req: Request, res: Response) => {
       try {
           const payload = { ...req.body, businessId: req.user!.businessId };
           if (!payload.employeeUserId) payload.employeeUserId = req.user!.id;
           if (!payload.requestedByUserId) payload.requestedByUserId = req.user!.id;
           const r = await db.TrainingRecord.create(payload);
           await AuditLogService.log('CREATED_TRAINING', 'hr_training_records', String(r.id), null, {}, req);
           successResponse(res, r, "Training mapping defined.", 201);
       } catch (e: any) { errorResponse(res, e.message); }
   };

   listTrainingRequests = async (req: Request, res: Response) => {
       try {
           const businessId = req.user!.businessId;
           const canManage  = this.hasPermission(req, 'performance.manage') || this.hasPermission(req, 'performance.read');
           const page = Number(req.query.page  || 1);
           const size = Number(req.query.size  || 20);
           const where: any = { businessId };
           if (!canManage) where.employeeUserId = req.user!.id;          // employees see own only
           if (req.query.status)         where.status         = req.query.status;
           if (req.query.employeeUserId && canManage) where.employeeUserId = req.query.employeeUserId;
           const { count, rows } = await db.TrainingRecord.findAndCountAll({
               where,
               include: [
                   { model: db.User, as: 'employee',  attributes: ['id', 'fullName', 'email'], required: false },
                   { model: db.User, as: 'requester', attributes: ['id', 'fullName'],          required: false },
               ],
               order: [['createdAt', 'DESC']],
               limit:  size,
               offset: (page - 1) * size,
           });
           successResponse(res, { rows, total: count, page, totalPages: Math.ceil(count / size) });
       } catch (e: any) { errorResponse(res, e.message); }
   };

   approveTrainingRequest = async (req: Request, res: Response) => {
       try {
           const r = await db.TrainingRecord.findOne({ where: { id: req.params.id, businessId: req.user!.businessId } });
           if (!r) return errorResponse(res, 'Training record not found', 404);
           if (r.status !== 'requested') return errorResponse(res, 'Only requested records can be approved', 400);
           await r.update({ status: 'scheduled', resultData: { ...(r.resultData || {}), approvedBy: req.user!.id, approvedAt: new Date(), comment: req.body.comment } });
           await AuditLogService.log('APPROVED_TRAINING', 'hr_training_records', String(r.id), null, {}, req);
           successResponse(res, r, 'Training request approved.');
       } catch (e: any) { errorResponse(res, e.message); }
   };

   rejectTrainingRequest = async (req: Request, res: Response) => {
       try {
           const r = await db.TrainingRecord.findOne({ where: { id: req.params.id, businessId: req.user!.businessId } });
           if (!r) return errorResponse(res, 'Training record not found', 404);
           if (r.status !== 'requested') return errorResponse(res, 'Only requested records can be rejected', 400);
           await r.update({ status: 'cancelled', resultData: { ...(r.resultData || {}), rejectedBy: req.user!.id, rejectedAt: new Date(), reason: req.body.reason } });
           await AuditLogService.log('REJECTED_TRAINING', 'hr_training_records', String(r.id), null, {}, req);
           successResponse(res, r, 'Training request rejected.');
       } catch (e: any) { errorResponse(res, e.message); }
   };

   // Promotion Requests
   createPromotionRequest = async (req: Request, res: Response) => {
       try {
           const { currentTitle, targetTitle, justification, department, kpiScore, yearsInRole, effectiveDate, employeeUserId } = req.body;
           if (!currentTitle || !targetTitle || !justification) return errorResponse(res, 'currentTitle, targetTitle, and justification are required', 400);
           const r = await db.PromotionRequest.create({
               businessId:        req.user!.businessId,
               employeeUserId:    employeeUserId || req.user!.id,
               requestedByUserId: req.user!.id,
               currentTitle, targetTitle, justification, department,
               kpiScore:    kpiScore    ? parseFloat(kpiScore)    : null,
               yearsInRole: yearsInRole ? parseFloat(yearsInRole) : null,
               effectiveDate: effectiveDate || null,
               approvalStage: 'department_head',
               status:        'pending',
           });
           await AuditLogService.log('CREATED_PROMOTION_REQUEST', 'hr_promotion_requests', String(r.id), null, {}, req);
           successResponse(res, r, 'Promotion request submitted.', 201);
       } catch (e: any) { errorResponse(res, e.message); }
   };

   listPromotionRequests = async (req: Request, res: Response) => {
       try {
           const businessId = req.user!.businessId;
           const canManage  = this.hasPermission(req, 'performance.manage') || this.hasPermission(req, 'performance.read');
           const page = Number(req.query.page || 1);
           const size = Number(req.query.size || 20);
           const where: any = { businessId };
           if (!canManage) where.employeeUserId = req.user!.id;
           if (req.query.status)         where.status         = req.query.status;
           if (req.query.employeeUserId && canManage) where.employeeUserId = req.query.employeeUserId;
           const { count, rows } = await db.PromotionRequest.findAndCountAll({
               where,
               include: [
                   { model: db.User, as: 'employee',  attributes: ['id', 'fullName', 'email'], required: false },
                   { model: db.User, as: 'requester', attributes: ['id', 'fullName'],          required: false },
               ],
               order: [['createdAt', 'DESC']],
               limit:  size,
               offset: (page - 1) * size,
           });
           successResponse(res, { rows, total: count, page, totalPages: Math.ceil(count / size) });
       } catch (e: any) { errorResponse(res, e.message); }
   };

   approvePromotionRequest = async (req: Request, res: Response) => {
       try {
           const r = await db.PromotionRequest.findOne({ where: { id: req.params.id, businessId: req.user!.businessId } });
           if (!r) return errorResponse(res, 'Promotion request not found', 404);
           if (r.status !== 'pending') return errorResponse(res, 'Only pending requests can be approved', 400);

           // Multi-stage: dept_head → admin → approved
           let nextStage = 'admin';
           let nextStatus: string = 'pending';
           if (r.approvalStage === 'department_head') {
               nextStage  = 'admin';
               nextStatus = 'pending';
           } else if (r.approvalStage === 'admin') {
               nextStage  = 'approved';
               nextStatus = 'approved';
           }
           await r.update({
               approvalStage:   nextStage,
               status:          nextStatus,
               deptHeadComment: r.approvalStage === 'department_head' ? (req.body.comment || null) : r.deptHeadComment,
               adminComment:    r.approvalStage === 'admin'           ? (req.body.comment || null) : r.adminComment,
           });
           await AuditLogService.log('APPROVED_PROMOTION_STAGE', 'hr_promotion_requests', String(r.id), null, { stage: r.approvalStage }, req);
           successResponse(res, r, nextStatus === 'approved' ? 'Promotion fully approved.' : 'Forwarded to next approver.');
       } catch (e: any) { errorResponse(res, e.message); }
   };

   rejectPromotionRequest = async (req: Request, res: Response) => {
       try {
           const r = await db.PromotionRequest.findOne({ where: { id: req.params.id, businessId: req.user!.businessId } });
           if (!r) return errorResponse(res, 'Promotion request not found', 404);
           if (r.status !== 'pending') return errorResponse(res, 'Only pending requests can be rejected', 400);
           await r.update({ status: 'rejected', rejectionReason: req.body.reason || null });
           await AuditLogService.log('REJECTED_PROMOTION', 'hr_promotion_requests', String(r.id), null, {}, req);
           successResponse(res, r, 'Promotion request rejected.');
       } catch (e: any) { errorResponse(res, e.message); }
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
   analyzeAttendanceDiscipline = async (req: Request, res: Response) => {
       try {
           const businessId   = req.user!.businessId;
           const windowDays    = Number(req.body.windowDays    ?? req.query.windowDays    ?? 30);
           const lateThreshold = Number(req.body.lateThreshold ?? req.query.lateThreshold ?? 3);
           const dryRun        = req.body.dryRun === true  || req.body.dryRun === 'true'
                              || req.query.dryRun === 'true';
           const includeMissed = req.body.includeMissed !== false && req.body.includeMissed !== 'false';
           const includeLate   = req.body.includeLate   !== false && req.body.includeLate   !== 'false';

           // ── 1. Compute date range ────────────────────────────────────────────
           const { Op } = require('sequelize');
           const settings = await db.BusinessAttendanceSettings.findOne({ where: { businessId } });
           if (!settings) return errorResponse(res, 'Attendance settings not configured', 400);
           const tz = settings.timezone || 'UTC';

           const toYmd = (d: Date) =>
               new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
           const today = new Date();
           const since = new Date(today);
           since.setDate(since.getDate() - windowDays);
           const startDate = toYmd(since);
           const endDate   = toYmd(today);
           const periodLabel = `${startDate} to ${endDate}`;
           const analysisRunId = crypto.randomUUID();

           // ── 2. Use the HR attendance report service ──────────────────────────
           const { AttendanceHrService } = require('../attendanceHr/attendanceHr.service');
           const hrService = new AttendanceHrService();
           const reportData = await hrService.report(businessId, {
               startDate, endDate,
               departmentId: null, employeeId: null,
               status: null, search: null,
               sortBy: 'name', sortOrder: 'asc',
           });
           const rows: any[] = reportData.rows ?? [];

           // ── 3. Group by employee — count MISSED and LATE days ────────────────
           type EmpInfraction = { date: string; status: string; lateByMinutes: number };
           type EmpEntry = {
               userId: string; fullName: string; email: string; dept: string;
               missedDays: number; lateDays: number; totalLateMinutes: number;
               infractions: EmpInfraction[];
           };
           const byEmployee = new Map<string, EmpEntry>();

           for (const row of rows) {
               const isMissed = row.currentStatus === 'MISSED';
               const isLate   = row.currentStatus === 'LATE';
               if ((!includeMissed && isMissed) || (!includeLate && isLate)) continue;
               if (!isMissed && !isLate) continue;

               const uid  = String(row.employeeId);
               const emp: EmpEntry = byEmployee.get(uid) ?? {
                   userId: uid,
                   fullName: row.employeeName ?? 'Unknown',
                   email:    '',
                   dept:     row.department?.name ?? 'Unknown',
                   missedDays: 0, lateDays: 0, totalLateMinutes: 0,
                   infractions: [] as EmpInfraction[],
               };
               if (isMissed) emp.missedDays++;
               if (isLate)   { emp.lateDays++; emp.totalLateMinutes += Number(row.lateByMinutes || 0); }
               emp.infractions.push({ date: row.date, status: row.currentStatus, lateByMinutes: Number(row.lateByMinutes || 0) });
               byEmployee.set(uid, emp);
           }

           // Enrich with emails from Users
           const userIds = Array.from(byEmployee.keys());
           if (userIds.length) {
               const users = await db.User.findAll({ where: { id: { [Op.in]: userIds }, businessId }, attributes: ['id', 'email'] });
               for (const u of users) {
                   const emp = byEmployee.get(String(u.id));
                   if (emp) emp.email = u.email ?? '';
               }
           }

           // ── 4. Build report + auto-action ────────────────────────────────────
           const report: any[] = [];
           const actioned: string[] = [];
           const skipped:  string[] = [];

           for (const emp of byEmployee.values()) {
               const totalInfractions = emp.missedDays + emp.lateDays;
               // Severity score: each missed = 2pts, each late = 1pt, +1 per 30min late
               const rawScore  = (emp.missedDays * 2) + emp.lateDays + Math.floor(emp.totalLateMinutes / 30);
               const severity  = rawScore >= 10 ? 'critical' : rawScore >= 5 ? 'major' : 'minor';
               const scoreDisp = `${Math.min(rawScore, 10).toFixed(1)}/10`;

               const entry: any = {
                   userId:           emp.userId,
                   fullName:         emp.fullName,
                   email:            emp.email,
                   department:       emp.dept,
                   missedDays:       emp.missedDays,
                   lateDays:         emp.lateDays,
                   totalLateMinutes: emp.totalLateMinutes,
                   totalInfractions,
                   severity,
                   score:            scoreDisp,
                   infractions:      emp.infractions,
                   actionCreated:    false,
               };

               if (totalInfractions >= lateThreshold) {
                   if (!dryRun) {
                       const existing = await db.DisciplinaryCase.findOne({
                           where: {
                               businessId,
                               employeeUserId: emp.userId,
                               caseType: 'attendance',
                               status: { [Op.notIn]: ['closed', 'resolved'] },
                           },
                       });

                       if (!existing) {
                           const parts: string[] = [];
                           if (emp.missedDays > 0) parts.push(`${emp.missedDays} missed day(s)`);
                           if (emp.lateDays   > 0) parts.push(`${emp.lateDays} late day(s) (${emp.totalLateMinutes}min total)`);

                           const caseRecord = await db.DisciplinaryCase.create({
                               businessId,
                               employeeUserId:   emp.userId,
                               reportedByUserId: req.user!.id,
                               caseType:         'attendance',
                               severity,
                               title:            `Attendance Issue: ${parts.join(' & ')} over ${windowDays} days`,
                               description:      `Automated analysis for ${periodLabel}: employee recorded ${parts.join(' and ')}. Total infraction score: ${scoreDisp}. This case was auto-generated by the attendance discipline analyzer.`,
                               status:           'open',
                               metadata: {
                                   score:            parseFloat(scoreDisp),
                                   missedDays:       emp.missedDays,
                                   lateDays:         emp.lateDays,
                                   totalLateMinutes: emp.totalLateMinutes,
                                   period:           periodLabel,
                                   analysisRunId,
                                   generatedAt:      new Date().toISOString(),
                                   autoGenerated:    true,
                                   notificationStatus: {
                                       employeesSentAt: null,
                                       managersSentAt: null,
                                   },
                               },
                           });

                           await AuditLogService.log('AUTO_DISCIPLINE_ATTENDANCE', 'hr_disciplinary_cases', String(caseRecord.id), null, { employeeUserId: emp.userId }, req);

                           // Notify the EMPLOYEE directly — not admins
                           try {
                               const missedMsg  = emp.missedDays > 0 ? `${emp.missedDays} missed check-in(s)` : '';
                               const lateMsg    = emp.lateDays   > 0 ? `${emp.lateDays} late check-in(s)` : '';
                               const detailMsg  = [missedMsg, lateMsg].filter(Boolean).join(' and ');
                               if (false) await InternalNotifier.send({
                                   businessId,
                                   recipientUserId: emp.userId,
                                   senderUserId:    req.user!.id,
                                   moduleKey:       'hr',
                                   type:            'attendance_discipline_warning',
                                   title:           'Attendance Improvement Notice',
                                   message:         `Dear ${emp.fullName}, our records show ${detailMsg} over the past ${windowDays} days. Please improve your attendance. A formal case has been opened — contact HR for support.`,
                                   entityType:      'DisciplinaryCase',
                                   entityId:        String(caseRecord.id),
                                   priority:        severity === 'critical' ? 'urgent' : severity === 'major' ? 'high' : 'normal',
                               });
                           } catch (notifErr) {
                               console.error('[AttendanceAnalysis] Notification failed for', emp.userId, notifErr);
                           }

                           entry.actionCreated = true;
                           entry.caseId = caseRecord.id;
                           entry.analysisRunId = analysisRunId;
                           actioned.push(emp.fullName);
                       } else {
                           entry.existingCaseId = existing.id;
                           skipped.push(emp.fullName);
                       }
                   } else {
                       entry.wouldAction = true;
                   }
               }
               report.push(entry);
           }

           report.sort((a, b) => b.totalInfractions - a.totalInfractions);

           successResponse(res, {
               windowDays, lateThreshold, dryRun, includeMissed, includeLate,
               analysisRunId,
               period:         periodLabel,
               totalEmployees: report.length,
               actioned:       actioned.length,
               skipped:        skipped.length,
               actionedNames:  actioned,
               skippedNames:   skipped,
               report,
           }, dryRun
               ? `Dry run: ${report.filter(r => r.wouldAction).length} employees would receive discipline cases.`
               : `Analysis complete. ${actioned.length} new case(s) created for manager review. No notifications sent yet.`
           );
       } catch (e: any) { errorResponse(res, e.message); }
   };

   sendAttendanceDisciplineAnalysis = async (req: Request, res: Response) => {
       try {
           const { Op } = require('sequelize');
           const businessId = req.user!.businessId;
           const audience = req.body?.audience === 'managers' ? 'managers' : 'all';
           const analysisRunId = req.body?.analysisRunId ? String(req.body.analysisRunId) : '';
           const caseIds = Array.isArray(req.body?.caseIds) ? req.body.caseIds.filter(Boolean).map(String) : [];
           const metadataWhere: any = { autoGenerated: true };
           if (analysisRunId) metadataWhere.analysisRunId = analysisRunId;
           const where: any = {
               businessId,
               caseType: 'attendance',
               status: 'under_review',
               metadata: { [Op.contains]: metadataWhere },
           };
           if (caseIds.length) where.id = { [Op.in]: caseIds };
           const cases = await db.DisciplinaryCase.findAll({
               where,
               include: [{ model: db.User, as: 'employee', attributes: ['id', 'fullName', 'email'], required: false }],
               order: [['createdAt', 'DESC']],
           });

           let managerIds: string[] = [];
           if (audience === 'managers') {
               const managers = await db.User.findAll({
                   where: { businessId, status: 'active' },
                   include: [{
                       model: db.Role,
                       through: { attributes: [] },
                       where: { key: { [Op.in]: ['HR_MANAGER', 'BUSINESS_ADMIN'] } },
                       required: true,
                   }],
                   attributes: ['id'],
               });
               managerIds = Array.from(new Set(managers.map((u: any) => String(u.id))));
           }

           let sent = 0;
           for (const c of cases) {
               const metadata = c.metadata || {};
               const notificationStatus = metadata.notificationStatus || {};
               const alreadySent = audience === 'managers' ? notificationStatus.managersSentAt : notificationStatus.employeesSentAt;
               if (alreadySent) continue;

               const score = metadata.score ? `${metadata.score}/10` : c.severity;
               const recipients = audience === 'managers' ? managerIds : [String(c.employeeUserId)];
               for (const recipientUserId of recipients) {
                   await InternalNotifier.send({
                       businessId,
                       recipientUserId,
                       senderUserId: req.user!.id,
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

           await AuditLogService.log('SENT_ATTENDANCE_DISCIPLINE_ANALYSIS', 'hr_disciplinary_cases', analysisRunId || 'all_open_generated', null, { audience, sent, caseCount: cases.length }, req);
           successResponse(res, { sent, caseCount: cases.length, audience }, `Sent ${sent} notification(s) to ${audience === 'managers' ? 'managers' : 'employees'}.`);
       } catch (e: any) { errorResponse(res, e.message); }
   };

   resetAttendanceDisciplineAnalysis = async (req: Request, res: Response) => {
       try {
           const { Op } = require('sequelize');
           const businessId = req.user!.businessId;
           const resetBatchId = crypto.randomUUID();
           const resetAt = new Date().toISOString();
           const cases = await db.DisciplinaryCase.findAll({
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

           await AuditLogService.log(
               'RESET_ATTENDANCE_DISCIPLINE_ANALYSIS',
               'hr_disciplinary_cases',
               resetBatchId,
               null,
               { archived: cases.length, resetBatchId, resetAt },
               req,
           );
           successResponse(res, { archived: cases.length, resetBatchId, resetAt }, `Attendance analysis reset. ${cases.length} generated case(s) archived with reset batch ${resetBatchId}.`);
       } catch (e: any) { errorResponse(res, e.message); }
   };

   listDisciplinaryCases = async (req: Request, res: Response) => {
       try {
           const businessId = req.user!.businessId;
           const page = Number(req.query.page || 1);
           const size = Number(req.query.size || 50);
           const where: any = { businessId };
           if (req.query.status) where.status = req.query.status;
           if (req.query.severity) where.severity = req.query.severity;
           const { Op } = require('sequelize');
           const { count, rows } = await db.DisciplinaryCase.findAndCountAll({
               where,
               include: [
                   { model: db.User, as: 'employee', attributes: ['id', 'fullName', 'email'], required: false },
                   { model: db.User, as: 'reporter', attributes: ['id', 'fullName'], required: false },
               ],
               order: [['createdAt', 'DESC']],
               limit:  size,
               offset: (page - 1) * size,
           });
           const employeeIds = Array.from(new Set(rows.map((r: any) => String(r.employeeUserId)).filter(Boolean)));
           const unavailableReasons = employeeIds.length ? await db.AttendanceRequest.findAll({
               where: {
                   businessId,
                   employeeUserId: { [Op.in]: employeeIds },
                   requestType: 'not_available',
                   status: { [Op.in]: ['pending', 'approved'] },
               },
               order: [['createdAt', 'DESC']],
               limit: 100,
           }) : [];
           const lateExplanations = employeeIds.length ? await db.AttendanceLateExplanation.findAll({
               where: {
                   businessId,
                   employeeId: { [Op.in]: employeeIds },
               },
               include: [{ model: db.AttendanceLateReason, as: 'reason', attributes: ['id', 'name'] }],
               order: [['createdAt', 'DESC']],
               limit: 100,
           }) : [];
           const unavailableByEmployee = new Map<string, any[]>();
           for (const item of unavailableReasons) {
               const key = String(item.employeeUserId);
               unavailableByEmployee.set(key, [...(unavailableByEmployee.get(key) || []), item]);
           }
           const lateByEmployee = new Map<string, any[]>();
           for (const item of lateExplanations) {
               const key = String(item.employeeId);
               lateByEmployee.set(key, [...(lateByEmployee.get(key) || []), item]);
           }
           const enrichedRows = rows.map((row: any) => {
               const plain = row.toJSON();
               const key = String(plain.employeeUserId);
               plain.attendanceReasons = {
                   unavailable: (unavailableByEmployee.get(key) || []).slice(0, 3).map((item: any) => ({
                       id: item.id,
                       title: item.title,
                       category: item.category,
                       reason: item.reason,
                       status: item.status,
                       fromAt: item.fromAt,
                       toAt: item.toAt,
                       createdAt: item.createdAt,
                   })),
                   late: (lateByEmployee.get(key) || []).slice(0, 3).map((item: any) => ({
                       id: item.id,
                       reasonName: item.reason?.name || null,
                       customReason: item.customReason || null,
                       lateByMinutes: item.lateByMinutes,
                       createdAt: item.createdAt,
                   })),
               };
               return plain;
           });
           successResponse(res, { rows: enrichedRows, total: count, page, totalPages: Math.ceil(count / size) });
       } catch (e: any) { errorResponse(res, e.message); }
   };

   createDisciplinaryCase = async (req: Request, res: Response) => {
       try {
           const { employeeUserId, caseType, severity, title, description, metadata } = req.body;
           if (!employeeUserId || !caseType || !title || !description) {
               return errorResponse(res, 'employeeUserId, caseType, title and description are required', 400);
           }
           const r = await db.DisciplinaryCase.create({
               businessId: req.user!.businessId,
               employeeUserId,
               reportedByUserId: req.user!.id,
               caseType,
               severity: severity || 'minor',
               title,
               description,
               status: 'open',
               metadata: metadata || {},
           });
           await AuditLogService.log('CREATED_DISCIPLINARY_CASE', 'hr_disciplinary_cases', String(r.id), null, {}, req);
           successResponse(res, r, 'Disciplinary case created.', 201);
       } catch (e: any) { errorResponse(res, e.message); }
   };

   updateDisciplinaryCase = async (req: Request, res: Response) => {
       try {
           const r = await db.DisciplinaryCase.findOne({ where: { id: req.params.id, businessId: req.user!.businessId } });
           if (!r) return errorResponse(res, 'Disciplinary case not found', 404);
           const allowed = ['status', 'actionTaken', 'severity', 'metadata'];
           const payload: any = {};
           for (const key of allowed) if (req.body[key] !== undefined) payload[key] = req.body[key];
           await r.update(payload);
           await AuditLogService.log('UPDATED_DISCIPLINARY_CASE', 'hr_disciplinary_cases', String(r.id), null, payload, req);
           successResponse(res, r, 'Disciplinary case updated.');
       } catch (e: any) { errorResponse(res, e.message); }
   };

   projectDashboard = async (req: Request, res: Response) => {
       try {
           const data = await this.service.getProjectPerformanceDashboard(req.user!.businessId, req.query);
           successResponse(res, data);
       } catch (e: any) { errorResponse(res, e.message); }
   };

   overview = async (req: Request, res: Response) => {
       try {
           const data = await this.service.getPerformanceOverview(req.user!.businessId, req.query);
           successResponse(res, data);
       } catch (e: any) { errorResponse(res, e.message); }
   };

   listReviews = async (req: Request, res: Response) => {
       try {
           const data = await this.service.listPerformanceReviews(req.user!.businessId, req.query);
           successResponse(res, data);
       } catch (e: any) { errorResponse(res, e.message); }
   };

   probationDashboard = async (req: Request, res: Response) => {
       try {
           const data = await this.service.getProbationDashboard(req.user!.businessId, req.query);
           successResponse(res, data);
       } catch (e: any) { errorResponse(res, e.message); }
   };

   updateProbationWeights = async (req: Request, res: Response) => {
       try {
           const data = await this.service.updateProbationWeights(req.user!.businessId, req.body || {});
           successResponse(res, data, 'Probation assessment weights updated.');
       } catch (e: any) { errorResponse(res, e.message); }
   };

   employeeEvaluationEvidence = async (req: Request, res: Response) => {
       try {
           const data = await this.service.getEmployeeEvaluationEvidence(req.user!.businessId, req.params.employeeUserId, req.query);
           successResponse(res, data);
       } catch (e: any) { errorResponse(res, e.message, e.message === 'Employee not found' ? 404 : 400); }
   };

   attachProjectEvidenceToReview = async (req: Request, res: Response) => {
       try {
           const review = await this.service.attachProjectEvidenceToReview(req.user!.businessId, req.params.reviewId);
           successResponse(res, review, 'Project evidence attached to review.');
       } catch (e: any) { errorResponse(res, e.message, e.message === 'Performance review not found' ? 404 : 400); }
   };

   // Disciplinary
   listDisciplinary = async (req: Request, res: Response) => {
       try {
           await this.service.restrictDisciplinaryAccess(req.user!.businessId, req.user);
           const limit = Number(req.query.limit || 20);
           const offset = Number(req.query.offset || 0);
           const result = await db.DisciplinaryCase.findAndCountAll({ where: { businessId: req.user!.businessId }, limit, offset });
           paginationResponse(res, result.rows, result.count, offset/limit + 1, limit);
       } catch (e: any) { errorResponse(res, e.message, 403); }
   };

   // ── Exit Workflow ─────────────────────────────────────────────────────────

   // GET /hr/exit — list all exit processes (HR admin view)
   listExitProcesses = async (req: Request, res: Response) => {
       try {
           const businessId = req.user!.businessId;
           const limit  = Number(req.query.limit  || 50);
           const offset = Number(req.query.offset || 0);
           const status = req.query.status as string | undefined;

           const where: any = { businessId };
           if (status) where.status = status;

           const result = await db.ExitProcess.findAndCountAll({
               where,
               limit,
               offset,
               order: [['createdAt', 'DESC']],
               include: [
                   {
                       model: db.User,
                       as: 'employee',
                       attributes: ['id', 'fullName', 'email'],
                       include: [{
                           model: db.BusinessUserProfile,
                           required: false,
                           include: [
                               { model: db.Department, as: 'department', attributes: ['id', 'name'] },
                               { model: db.Position,   as: 'position',   attributes: ['id', 'title'] },
                           ],
                       }],
                   },
                   {
                       model: db.User,
                       as: 'initiator',
                   attributes: ['id', 'fullName', 'email'],
               },
               {
                   model: db.User,
                   as: 'reviewer',
                   attributes: ['id', 'fullName', 'email'],
               },
           ],
       });

           successResponse(res, { rows: result.rows, count: result.count });
       } catch (e: any) { errorResponse(res, e.message); }
   };

   listExitForms = async (req: Request, res: Response) => {
       try {
           await this.service.provisionForms(req.user!.businessId);
           const forms = await db.FormDefinition.findAll({
               where: { businessId: req.user!.businessId, moduleKey: 'hr', key: ['employee_resignation', 'exit_interview', 'offboarding_checklist', 'asset_return_clearance', 'experience_letter'] },
               include: [{ model: db.FormSubmission, attributes: ['id'], required: false }],
               order: [['updatedAt', 'DESC']],
           });
           successResponse(res, forms.map((form: any) => ({
               ...form.toJSON(),
               usageCount: form.FormSubmissions?.length || form.FormSubmissions?.length === 0 ? form.FormSubmissions.length : 0,
               version: form.settings?.version || 1,
               category: form.settings?.category || 'exit',
           })));
       } catch (e: any) { errorResponse(res, e.message); }
   };

   createExitForm = async (req: Request, res: Response) => {
       try {
           const form = await db.FormDefinition.create({
               businessId: req.user!.businessId,
               moduleKey: 'hr',
               name: req.body.name,
               key: req.body.key || String(req.body.name || 'exit_form').toLowerCase().replace(/\s+/g, '_'),
               description: req.body.description || null,
               status: req.body.status || 'active',
               settings: { ...(req.body.settings || {}), category: 'exit', version: req.body.version || 1 },
           });
           successResponse(res, form, 'Exit form created.', 201);
       } catch (e: any) { errorResponse(res, e.message); }
   };

   updateExitForm = async (req: Request, res: Response) => {
       try {
           const form = await db.FormDefinition.findOne({ where: { id: req.params.id, businessId: req.user!.businessId, moduleKey: 'hr' } });
           if (!form) return errorResponse(res, 'Form not found', 404);
           const settings = { ...(form.settings || {}), ...(req.body.settings || {}) };
           if (req.body.version !== undefined) settings.version = req.body.version;
           if (!settings.category) settings.category = 'exit';
           await form.update({
               name: req.body.name ?? form.name,
               description: req.body.description ?? form.description,
               status: req.body.status ?? form.status,
               settings,
           });
           successResponse(res, form, 'Exit form updated.');
       } catch (e: any) { errorResponse(res, e.message); }
   };

   deleteExitForm = async (req: Request, res: Response) => {
       try {
           const form = await db.FormDefinition.findOne({ where: { id: req.params.id, businessId: req.user!.businessId, moduleKey: 'hr' } });
           if (!form) return errorResponse(res, 'Form not found', 404);
           await form.destroy();
           successResponse(res, null, 'Exit form deleted.');
       } catch (e: any) { errorResponse(res, e.message); }
   };

   downloadExitForm = async (req: Request, res: Response) => {
       try {
           const form = await db.FormDefinition.findOne({ where: { id: req.params.id, businessId: req.user!.businessId, moduleKey: 'hr' } });
           if (!form) return errorResponse(res, 'Form not found', 404);
           res.setHeader('Content-Type', 'application/json');
           res.setHeader('Content-Disposition', `attachment; filename="${form.key}.json"`);
           res.send(JSON.stringify(form.toJSON(), null, 2));
       } catch (e: any) { errorResponse(res, e.message); }
   };

   getExitAnalytics = async (req: Request, res: Response) => {
       try {
           const data = await this.service.getExitAnalytics(req.user!.businessId, req.query);
           successResponse(res, data);
       } catch (e: any) { errorResponse(res, e.message); }
   };

   // GET /hr/exit/me - current employee's latest exit request
   getMyExitProcess = async (req: Request, res: Response) => {
       try {
           const result = await db.ExitProcess.findOne({
               where: {
                   businessId: req.user!.businessId,
                   employeeUserId: req.user!.id,
               },
               order: [['createdAt', 'DESC']],
               include: [
                   {
                       model: db.User,
                       as: 'employee',
                       attributes: ['id', 'fullName', 'email'],
                   },
                   {
                       model: db.User,
                       as: 'initiator',
                       attributes: ['id', 'fullName', 'email'],
                   },
               ],
           });

           if (!result) return successResponse(res, result);
           const scheduledInterview = await db.ExitInterview.findOne({
               where: {
                   businessId: req.user!.businessId,
                   exitProcessId: result.id,
                   status: 'scheduled',
               },
               include: [{ model: db.User, as: 'interviewer', attributes: ['id', 'fullName', 'email'] }],
               order: [['scheduledAt', 'ASC']],
           });
           successResponse(res, { ...result.toJSON(), scheduledInterview: scheduledInterview ? scheduledInterview.toJSON() : null });
       } catch (e: any) { errorResponse(res, e.message); }
   };

   // GET /hr/exit/:id - tenant-scoped exit request detail
   getExitProcess = async (req: Request, res: Response) => {
       try {
           const result = await db.ExitProcess.findOne({
               where: {
                   id: req.params.id,
                   businessId: req.user!.businessId,
               },
               include: [
                   {
                       model: db.User,
                       as: 'employee',
                       attributes: ['id', 'fullName', 'email'],
                       include: [{
                           model: db.BusinessUserProfile,
                           required: false,
                           include: [
                               { model: db.Department, as: 'department', attributes: ['id', 'name'] },
                               { model: db.Position,   as: 'position',   attributes: ['id', 'title'] },
                           ],
                       }],
                   },
                   {
                       model: db.User,
                       as: 'initiator',
                       attributes: ['id', 'fullName', 'email'],
                   },
               ],
           });

           if (!result) return errorResponse(res, 'Exit process not found', 404);
           successResponse(res, result);
       } catch (e: any) { errorResponse(res, e.message); }
   };

   // POST /hr/exit/resign — employee submits offboarding request with rich text letter
   submitResignation = async (
     req: Request,
     res: Response,
   ) => {
     try {
       const businessId =
         req.user!.businessId;

       const exitProcess =
         await db.sequelize.transaction(
           async (transaction: any) => {
             const created =
               await this.exitWorkflowService.create(
                 {
                   businessId,

                   employeeUserId:
                     req.user!.id,

                   initiatedByUserId:
                     req.user!.id,

                   initiatedByType:
                     "employee",

                   body: {
                     ...req.body,
                     exitType:
                       "resignation",
                   },
                 },

                 transaction,
               );

             await this.service.seedExitClearanceSteps(
               businessId,
               String(created.id),
               transaction,
             );

             await this.service.seedExitDocuments(
               businessId,
               String(created.id),
               transaction,
             );

             return created;
           },
         );

       await AuditLogService.log(
         "EXIT_EMPLOYEE_INITIATED",
         "hr_exit_processes",
         String(exitProcess.id),
         null,
         {
           exitMode:
             exitProcess.exitMode,

           noticePeriodDays:
             exitProcess.noticePeriodDays,
         },
         req,
       );

       await this.logExitEvent(
         req,
         String(exitProcess.id),
         "EXIT_EMPLOYEE_INITIATED",
         {
           status:
             exitProcess.status,
         },
       );

       try {
         const adminUsers =
           await db.User.findAll({
             where: {
               businessId,
               status: "active",
             },

             include: [
               {
                 model: db.Role,

                 through: {
                   attributes: [],
                 },

                 where: {
                   key: [
                     "BUSINESS_ADMIN",
                     "HR_MANAGER",
                   ],
                 },

                 required: true,
               },
             ],

             attributes: ["id"],
           });

         const recipientUserIds =
           adminUsers
             .map(
               (user: any) =>
                 String(user.id),
             )
             .filter(
               (id: string) =>
                 id !== req.user!.id,
             );

         if (
           recipientUserIds.length > 0
         ) {
           const employee =
             await db.User.findByPk(
               req.user!.id,
               {
                 attributes: [
                   "fullName",
                 ],
               },
             );

           await InternalNotifier.sendBulk({
             businessId,

             recipientUserIds,

             senderUserId:
               req.user!.id,

             moduleKey: "hr",

             type:
               "exit_submitted",

             title:
               "New Exit Request",

             message:
               `${employee?.fullName || "An employee"} submitted an exit request.`,

             entityType:
               "ExitProcess",

             entityId:
               String(
                 exitProcess.id,
               ),

             priority: "high",
           });
         }
       } catch (notificationError) {
         console.error(
           "[ExitProcess] Notification failed:",
           notificationError,
         );
       }

       successResponse(
         res,
         exitProcess,
         "Exit request submitted successfully.",
         201,
       );
     } catch (error: any) {
       errorResponse(
         res,
         error.message,
         400,
       );
     }
   };

   updateExitStatus = async (req: Request, res: Response) => {
       try {
           const before = await db.ExitProcess.findOne({ where: { id: req.params.id, businessId: req.user!.businessId } });
           const result = await this.service.processExit(req.user!.businessId, req.params.id, req.body.status, {
               reviewedByUserId: req.user!.id,
               effectiveDate: req.body.effectiveDate || req.body.confirmedLastWorkingDate,
               approvalNote: req.body.approvalNote,
               rejectionReason: req.body.rejectionReason || req.body.reason,
           });
           await AuditLogService.log('UPDATED_EXIT_PROCESS', 'hr_exit_processes', String(result.id), null, { status: req.body.status }, req);
           await this.logExitEvent(
               req,
               String(result.id),
               req.body.status === 'in_progress'
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
                   : 'EXIT_STATUS_UPDATED',
               { fromStatus: before?.status, status: req.body.status, approvalNote: req.body.approvalNote, rejectionReason: req.body.rejectionReason || req.body.reason }
           );
           successResponse(res, result);
       } catch (e: any) {
           const statusCode = e.message === 'Exit process not found.' ? 404 : 400;
           errorResponse(res, e.message, statusCode);
       }
   };

   approveExitRequest = async (
     req: Request,
     res: Response,
   ) => {
     try {
       const result =
         await this.exitWorkflowService.approve(
           req.user!.businessId,
           req.params.id,
           {
             reviewedByUserId:
               req.user!.id,

             effectiveDate:
               req.body.effectiveDate ||
               req.body.confirmedLastWorkingDate,

             approvalNote:
               req.body.approvalNote,
           },
         );

       await AuditLogService.log(
         "EXIT_APPROVED",
         "hr_exit_processes",
         String(result.id),
         null,
         {
           status:
             result.status,
         },
         req,
       );

       await this.logExitEvent(
         req,
         String(result.id),
         "EXIT_APPROVED",
         {
           status:
             result.status,
         },
       );

       await InternalNotifier.send({
         businessId:
           req.user!.businessId,

         recipientUserId:
           result.employeeUserId,

         senderUserId:
           req.user!.id,

         moduleKey: "hr",

         type:
           "exit_approved",

         title:
           "Exit Request Approved",

         message:
           "Your exit request was approved and has moved to clearance.",

         entityType:
           "ExitProcess",

         entityId:
           String(result.id),

         priority: "high",
       });

       successResponse(
         res,
         result,
         "Exit request approved.",
       );
     } catch (error: any) {
       errorResponse(
         res,
         error.message,
         error.message ===
           "Exit process not found."
           ? 404
           : 400,
       );
     }
   };

   sendOffboardingForm = async (req: Request, res: Response) => {
       try {
           const result = await this.service.sendOffboardingForm(req.user!.businessId, req.params.id, req.user!.id);
           const deviceCount = Array.isArray(result.offboardingFormData?.acceptedDevices) ? result.offboardingFormData.acceptedDevices.length : 0;
           await InternalNotifier.send({
               businessId: req.user!.businessId,
               recipientUserId: result.employeeUserId,
               senderUserId: req.user!.id,
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
           successResponse(res, result, 'Offboarding form sent and employee notified.');
       } catch (e: any) {
           errorResponse(res, e.message, e.message === 'Exit process not found.' ? 404 : 400);
       }
   };

   submitOffboardingForm = async (req: Request, res: Response) => {
       try {
           const result = await this.service.submitOffboardingForm(req.user!.businessId, req.params.id, req.user!.id, req.body || {});
           await this.logExitEvent(req, String(result.id), 'EXIT_OFFBOARDING_FORM_SUBMITTED', { employeeUserId: result.employeeUserId });
           successResponse(res, result, 'Offboarding form submitted.');
       } catch (e: any) {
           errorResponse(res, e.message, e.message === 'Exit process not found.' ? 404 : 400);
       }
   };

   rejectExitRequest = async (
     req: Request,
     res: Response,
   ) => {
     try {
       const result =
         await this.exitWorkflowService.reject(
           req.user!.businessId,
           req.params.id,
           {
             reviewedByUserId:
               req.user!.id,

             rejectionReason:
               req.body.rejectionReason ||
               req.body.reason,
           },
         );

       await AuditLogService.log(
         "EXIT_REJECTED",
         "hr_exit_processes",
         String(result.id),
         null,
         {
           rejectionReason:
             result.rejectionReason,
         },
         req,
       );

       await this.logExitEvent(
         req,
         String(result.id),
         "EXIT_REJECTED",
         {
           rejectionReason:
             result.rejectionReason,
         },
       );

       await InternalNotifier.send({
         businessId:
           req.user!.businessId,

         recipientUserId:
           result.employeeUserId,

         senderUserId:
           req.user!.id,

         moduleKey: "hr",

         type:
           "exit_rejected",

         title:
           "Exit Request Rejected",

         message:
           result.rejectionReason ||
           "Your exit request was rejected.",

         entityType:
           "ExitProcess",

         entityId:
           String(result.id),

         priority: "high",
       });

       successResponse(
         res,
         result,
         "Exit request rejected.",
       );
     } catch (error: any) {
       errorResponse(
         res,
         error.message,
         error.message ===
           "Exit process not found."
           ? 404
           : 400,
       );
     }
   };

   disableExitAccount = async (req: Request, res: Response) => {
       try {
           const result = await this.service.disableOffboardingAccount(req.user!.businessId, req.params.id, req.user!.id);
           await this.logExitEvent(req, String(result.id), 'EXIT_ACCOUNT_DISABLED', { employeeUserId: result.employeeUserId });
           successResponse(res, result, 'Employee account disabled and historical records preserved.');
       } catch (e: any) {
           errorResponse(res, e.message, e.message === 'Exit process not found.' ? 404 : 400);
       }
   };

   updateExitFinalPay = async (req: Request, res: Response) => {
       try {
           const result = await this.service.updateFinalPay(req.user!.businessId, req.params.id, req.user!.id, req.body || {});
           await AuditLogService.log('UPDATED_EXIT_FINAL_PAY', 'hr_exit_processes', String(result.id), null, result.finalPayData, req);
           if (result.finalPayData?.status === 'settled') await this.logExitEvent(req, String(result.id), 'EXIT_FINAL_PAYMENT_SETTLED', result.finalPayData);
           successResponse(res, result, 'Final pay updated.');
       } catch (e: any) {
           errorResponse(res, e.message, e.message === 'Exit process not found.' ? 404 : 400);
       }
   };

   createExitProcess = async (
     req: Request,
     res: Response,
   ) => {
     try {
       const employeeUserId =
         String(
           req.body.employeeUserId ||
             "",
         ).trim();

       if (!employeeUserId) {
         return errorResponse(
           res,
           "employeeUserId is required.",
           400,
         );
       }

       const exitProcess =
         await db.sequelize.transaction(
           async (transaction: any) => {
             const created =
               await this.exitWorkflowService.create(
                 {
                   businessId:
                     req.user!.businessId,

                   employeeUserId,

                   initiatedByUserId:
                     req.user!.id,

                   initiatedByType:
                     "employer",

                   body: req.body,
                 },

                 transaction,
               );

             await this.service.seedExitClearanceSteps(
               req.user!.businessId,
               String(created.id),
               transaction,
             );

             await this.service.seedExitDocuments(
               req.user!.businessId,
               String(created.id),
               transaction,
             );

             return created;
           },
         );

       await AuditLogService.log(
         "EXIT_EMPLOYER_INITIATED",
         "hr_exit_processes",
         String(exitProcess.id),
         null,
         {
           employeeUserId,
           exitType:
             exitProcess.exitType,
           exitMode:
             exitProcess.exitMode,
         },
         req,
       );

       await this.logExitEvent(
         req,
         String(exitProcess.id),
         "EXIT_EMPLOYER_INITIATED",
         {
           employeeUserId,
         },
       );

       await InternalNotifier.send({
         businessId:
           req.user!.businessId,

         recipientUserId:
           employeeUserId,

         senderUserId:
           req.user!.id,

         moduleKey: "hr",

         type:
           "exit_initiated",

         title:
           "Exit Process Started",

         message:
           "HR has started an exit process for your employment.",

         entityType:
           "ExitProcess",

         entityId:
           String(exitProcess.id),

         priority: "high",
       });

       successResponse(
         res,
         exitProcess,
         "Exit process initiated successfully.",
         201,
       );
     } catch (error: any) {
       errorResponse(
         res,
         error.message,
         400,
       );
     }
   };

   updateExitProcess = async (req: Request, res: Response) => {
       try {
           const ex = await db.ExitProcess.findOne({ where: { id: req.params.id, businessId: req.user!.businessId } });
           if (!ex) return errorResponse(res, 'Exit process not found', 404);
           const allowed: any = {};
           for (const key of ['reason', 'effectiveDate', 'clearanceData']) if (req.body[key] !== undefined) allowed[key] = req.body[key];
           await ex.update(allowed);
           await this.logExitEvent(req, String(ex.id), 'EXIT_PROCESS_UPDATED', allowed);
           successResponse(res, ex, 'Exit process updated.');
       } catch (e: any) { errorResponse(res, e.message); }
   };

   getExitTimeline = async (req: Request, res: Response) => {
       try {
           const exitProcess = await db.ExitProcess.findOne({ where: { id: req.params.id, businessId: req.user!.businessId } });
           if (!exitProcess) return errorResponse(res, 'Exit process not found', 404);
           const canReadAll = this.hasPermission(req, 'hr.read') || this.hasPermission(req, 'hr.write');
           const canReadOwn = this.hasPermission(req, 'exit.self') && exitProcess.employeeUserId === req.user!.id;
           if (!canReadAll && !canReadOwn) return errorResponse(res, 'Forbidden', 403);
           const events = await db.AuditLog.findAll({
               where: { businessId: req.user!.businessId, entityType: 'ExitProcess', entityId: req.params.id },
               include: [{ model: db.User, attributes: ['id', 'fullName', 'email'] }],
               order: [['createdAt', 'ASC']],
           });
           successResponse(res, events);
       } catch (e: any) { errorResponse(res, e.message); }
   };

   listExitClearance = async (req: Request, res: Response) => {
       try {
           const exitProcess = await this.service.getExitWithClearance(req.user!.businessId, req.params.id);
           if (!exitProcess) return errorResponse(res, 'Exit process not found', 404);

           const canReadAll = this.hasPermission(req, 'hr.write');
           const canReadOwn = this.hasPermission(req, 'exit.self') && exitProcess.employeeUserId === req.user!.id;
           if (!canReadAll && !canReadOwn) return errorResponse(res, 'Forbidden', 403);

           await this.service.seedExitClearanceSteps(req.user!.businessId, req.params.id);
           const refreshed = await this.service.getExitWithClearance(req.user!.businessId, req.params.id);
           successResponse(res, refreshed);
       } catch (e: any) { errorResponse(res, e.message); }
   };

   completeExitClearanceStep = async (req: Request, res: Response) => {
       try {
           const step = await this.service.updateClearanceStep(
               req.user!.businessId,
               req.params.id,
               req.params.stepId,
               { status: 'completed', notes: req.body?.notes },
               req.user!.id
           );
           await this.logExitEvent(req, req.params.id, 'EXIT_CLEARANCE_STEP_COMPLETED', { stepId: req.params.stepId });
           successResponse(res, step, 'Clearance step completed.');
       } catch (e: any) {
           errorResponse(res, e.message, e.message.includes('not found') ? 404 : 400);
       }
   };

   waiveExitClearanceStep = async (req: Request, res: Response) => {
       try {
           const step = await this.service.updateClearanceStep(
               req.user!.businessId,
               req.params.id,
               req.params.stepId,
               { status: 'waived', notes: req.body?.notes },
               req.user!.id
           );
           await this.logExitEvent(req, req.params.id, 'EXIT_CLEARANCE_STEP_WAIVED', { stepId: req.params.stepId });
           successResponse(res, step, 'Clearance step waived.');
       } catch (e: any) {
           errorResponse(res, e.message, e.message.includes('not found') ? 404 : 400);
       }
   };

   updateExitClearanceStep = async (req: Request, res: Response) => {
       try {
           const step = await this.service.updateClearanceStep(
               req.user!.businessId,
               req.params.id,
               req.params.stepId,
               req.body || {},
               req.user!.id
           );
           successResponse(res, step, 'Clearance step updated.');
       } catch (e: any) {
           errorResponse(res, e.message, e.message.includes('not found') ? 404 : 400);
       }
   };

   listExitInterviews = async (req: Request, res: Response) => {
       try {
           const interviews = await db.ExitInterview.findAll({
               where: { businessId: req.user!.businessId },
               include: [
                   ...this.service.exitProcessInclude(),
                   { model: db.User, as: 'interviewer', attributes: ['id', 'fullName', 'email'] },
               ],
               order: [['scheduledAt', 'ASC']],
           });
           successResponse(res, interviews);
       } catch (e: any) { errorResponse(res, e.message); }
   };

   createExitInterview = async (req: Request, res: Response) => {
       try {
           const exitProcess = await db.ExitProcess.findOne({ where: { id: req.params.id, businessId: req.user!.businessId } });
           if (!exitProcess) return errorResponse(res, 'Exit process not found', 404);
           const interview = await db.ExitInterview.create({
               businessId: req.user!.businessId,
               exitProcessId: req.params.id,
               title: req.body.title || 'Exit Interview',
               scheduledAt: req.body.scheduledAt || (req.body.interviewDate ? new Date(`${req.body.interviewDate}T${req.body.startTime || '09:00'}:00`) : new Date()),
               startTime: req.body.startTime || null,
               endTime: req.body.endTime || null,
               interviewType: req.body.interviewType || 'in-person',
               location: req.body.location || null,
               meetingUrl: req.body.meetingUrl || null,
               interviewerUserId: req.body.interviewerUserId || req.user!.id,
               panel: req.body.panel || [],
               status: 'scheduled',
           });
           await exitProcess.update({ status: 'interview_scheduled' });
           await this.logExitEvent(req, req.params.id, 'EXIT_INTERVIEW_SCHEDULED', { interviewId: interview.id, scheduledAt: interview.scheduledAt });
           successResponse(res, interview, 'Exit interview scheduled.', 201);
       } catch (e: any) { errorResponse(res, e.message); }
   };

   updateExitInterview = async (req: Request, res: Response) => {
       try {
           const interview = await db.ExitInterview.findOne({ where: { id: req.params.interviewId, businessId: req.user!.businessId } });
           if (!interview) return errorResponse(res, 'Exit interview not found', 404);
           const allowed = [
               'title', 'scheduledAt', 'startTime', 'endTime', 'interviewType', 'location', 'meetingUrl', 'interviewerUserId', 'panel', 'status', 'rating',
               'reasonForLeaving', 'satisfactionScore', 'managementFeedback', 'workEnvironmentFeedback',
               'careerDevelopmentFeedback', 'suggestions', 'employeeConcerns', 'rehireEligibility', 'handoverNotes', 'finalRecommendation', 'wouldRecommendCompany', 'remarks'
           ];
           const payload: any = {};
           for (const key of allowed) if (req.body[key] !== undefined) payload[key] = req.body[key];
           if (payload.status && !['scheduled', 'completed', 'cancelled'].includes(payload.status)) return errorResponse(res, 'Invalid interview status', 400);
           const updated = await interview.update(payload);
           successResponse(res, updated, 'Exit interview updated.');
       } catch (e: any) { errorResponse(res, e.message); }
   };

   completeExitInterview = async (req: Request, res: Response) => {
       try {
           const result = await db.sequelize.transaction(async (transaction: any) => {
               const interview = await db.ExitInterview.findOne({
                   where: { id: req.params.interviewId, businessId: req.user!.businessId },
                   transaction,
                   lock: true,
               });
               if (!interview) throw new Error('Exit interview not found');
               const payload: any = {
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
               const exitProcess = await db.ExitProcess.findOne({ where: { id: interview.exitProcessId, businessId: req.user!.businessId }, transaction, lock: true });
               if (exitProcess && !['in_progress', 'completed', 'account_disabled'].includes(String(exitProcess.status))) {
                   await exitProcess.update({ status: 'interview_completed' }, { transaction });
               }
               await this.service.completeClearanceStepByKey(
                   req.user!.businessId,
                   interview.exitProcessId,
                   'exit_interview_completed',
                   req.user!.id,
                   transaction
               );
               await this.logExitEvent(req, String(interview.exitProcessId), 'EXIT_INTERVIEW_COMPLETED', { interviewId: interview.id });
               return updated;
           });
           successResponse(res, result, 'Exit interview completed.');
       } catch (e: any) {
           errorResponse(res, e.message, e.message === 'Exit interview not found' ? 404 : 400);
       }
   };

   sendExitInterviewReminder = async (req: Request, res: Response) => {
       try {
           const interview = await db.ExitInterview.findOne({
               where: { id: req.params.interviewId, businessId: req.user!.businessId },
               include: this.service.exitProcessInclude(),
           });
           if (!interview) return errorResponse(res, 'Exit interview not found', 404);
           const exitProcess = interview.exitProcess;
           const employeeUserId = exitProcess?.employeeUserId;
           if (!employeeUserId) return errorResponse(res, 'Exit interview employee not found', 400);

           const scheduledAt = interview.scheduledAt ? new Date(interview.scheduledAt) : null;
           const dateLabel = scheduledAt ? scheduledAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'the scheduled date';
           const timeLabel = interview.startTime || (scheduledAt ? scheduledAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'the scheduled time');
           const placeLabel = interview.interviewType === 'in-person'
               ? (interview.location || 'the location HR shared')
               : (interview.meetingUrl || 'the meeting details HR shared');

           await InternalNotifier.send({
               businessId: req.user!.businessId,
               recipientUserId: employeeUserId,
               senderUserId: req.user!.id,
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

           successResponse(res, interview, 'Exit interview reminder notification sent.');
       } catch (e: any) { errorResponse(res, e.message); }
   };

   listExitDocuments = async (req: Request, res: Response) => {
       try {
           const exitProcess = await db.ExitProcess.findOne({ where: { id: req.params.id, businessId: req.user!.businessId } });
           if (!exitProcess) return errorResponse(res, 'Exit process not found', 404);
           const canReadAll = this.hasPermission(req, 'hr.read') || this.hasPermission(req, 'hr.write');
           const canReadOwn = this.hasPermission(req, 'exit.self') && exitProcess.employeeUserId === req.user!.id;
           if (!canReadAll && !canReadOwn) return errorResponse(res, 'Forbidden', 403);
           await this.service.seedExitDocuments(req.user!.businessId, req.params.id);
           const documents = await db.ExitDocument.findAll({
               where: { businessId: req.user!.businessId, exitProcessId: req.params.id },
               include: [
                   { model: db.User, as: 'uploadedBy', attributes: ['id', 'fullName', 'email'] },
                   { model: db.User, as: 'verifiedBy', attributes: ['id', 'fullName', 'email'] },
               ],
               order: [['createdAt', 'ASC']],
           });
           successResponse(res, { exitProcess, documents });
       } catch (e: any) { errorResponse(res, e.message); }
   };

   uploadExitDocument = async (req: Request, res: Response) => {
       try {
           const doc = await db.ExitDocument.findOne({ where: { id: req.params.documentId, exitProcessId: req.params.id, businessId: req.user!.businessId } });
           if (!doc) return errorResponse(res, 'Exit document not found', 404);
           if (!req.file) return errorResponse(res, 'No file uploaded', 400);
           const asset = await this.fileService.saveAssetRecord(req.user!.businessId, req.user!.id, req.file, {
               moduleKey: 'hr',
               entityType: 'ExitDocument',
               entityId: String(doc.id),
           });
           const fileUrl = `/api/files/${asset.id}/download`;
           const updated = await doc.update({
               status: 'uploaded',
               fileUrl,
               uploadedAt: new Date(),
               uploadedByUserId: req.user!.id,
           });
           await this.logExitEvent(req, req.params.id, 'EXIT_DOCUMENT_UPLOADED', { documentId: doc.id, documentKey: doc.documentKey });
           successResponse(res, updated, 'Exit document uploaded.');
       } catch (e: any) { errorResponse(res, e.message); }
   };

   verifyExitDocument = async (req: Request, res: Response) => {
       try {
           const doc = await db.ExitDocument.findOne({ where: { id: req.params.documentId, exitProcessId: req.params.id, businessId: req.user!.businessId } });
           if (!doc) return errorResponse(res, 'Exit document not found', 404);
           const updated = await doc.update({ status: 'verified', verifiedAt: new Date(), verifiedByUserId: req.user!.id });
           await this.logExitEvent(req, req.params.id, 'EXIT_DOCUMENT_VERIFIED', { documentId: doc.id, documentKey: doc.documentKey });
           successResponse(res, updated, 'Exit document verified.');
       } catch (e: any) { errorResponse(res, e.message); }
   };

   updateExitDocument = async (req: Request, res: Response) => {
       try {
           const doc = await db.ExitDocument.findOne({ where: { id: req.params.documentId, exitProcessId: req.params.id, businessId: req.user!.businessId } });
           if (!doc) return errorResponse(res, 'Exit document not found', 404);
           const payload: any = {};
           for (const key of ['title', 'required', 'status', 'notes']) if (req.body[key] !== undefined) payload[key] = req.body[key];
           if (payload.status && !['missing', 'uploaded', 'verified', 'waived'].includes(payload.status)) return errorResponse(res, 'Invalid document status', 400);
           const updated = await doc.update(payload);
           successResponse(res, updated, 'Exit document updated.');
       } catch (e: any) { errorResponse(res, e.message); }
   };

   downloadExitDocuments = async (req: Request, res: Response) => {
       try {
           const exitProcess = await db.ExitProcess.findOne({ where: { id: req.params.id, businessId: req.user!.businessId } });
           if (!exitProcess) return errorResponse(res, 'Exit process not found', 404);
           const canReadAll = this.hasPermission(req, 'hr.read') || this.hasPermission(req, 'hr.write');
           const canReadOwn = this.hasPermission(req, 'exit.self') && exitProcess.employeeUserId === req.user!.id;
           if (!canReadAll && !canReadOwn) return errorResponse(res, 'Forbidden', 403);
           const docs = await db.ExitDocument.findAll({
               where: { businessId: req.user!.businessId, exitProcessId: req.params.id },
               order: [['createdAt', 'ASC']],
           });
           successResponse(res, { documents: docs.filter((doc: any) => doc.fileUrl).map((doc: any) => ({ id: doc.id, title: doc.title, fileUrl: doc.fileUrl })) }, 'Exit document downloads ready.');
       } catch (e: any) { errorResponse(res, e.message); }
   };
}
