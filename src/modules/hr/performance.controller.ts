
import type { Request, Response } from 'express';
import { HRPerformanceService } from './performance.service';
import { errorResponse, successResponse, paginationResponse } from '../../utils/response';
import { AuditLogService } from '../../services/auditLog.service';
import { db } from '../../models';
import { InternalNotifier } from '../notification/notification.service';

export class HRPerformanceController {
   private service = new HRPerformanceService();

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
               ],
           });

           successResponse(res, { rows: result.rows, count: result.count });
       } catch (e: any) { errorResponse(res, e.message); }
   };

   // POST /hr/exit/resign — employee submits offboarding request with rich text letter
   submitResignation = async (req: Request, res: Response) => {
       try {
           const { effectiveDate, reason, letterHtml, noticePeriodDays } = req.body;
           const businessId = req.user!.businessId;

           if (!effectiveDate) {
               return errorResponse(res, 'effectiveDate is required', 400);
           }

           const ex = await db.ExitProcess.create({
               businessId,
               initiatedByUserId: req.user!.id,
               employeeUserId:    req.user!.id,
               exitType:          'resignation',
               effectiveDate,
               reason:            reason || null,
               status:            'pending',
               clearanceData: {
                   letterHtml:       letterHtml || null,
                   noticePeriodDays: noticePeriodDays || 30,
               },
           });

           await AuditLogService.log('SUBMIT_RESIGNATION', 'hr_exit_processes', String(ex.id), null, {}, req);

           // Notify all HR managers and business admins
           try {
               const adminUsers = await db.User.findAll({
                   where: { businessId, status: 'active' },
                   include: [{
                       model: db.Role,
                       through: { attributes: [] },
                       where: { key: ['BUSINESS_ADMIN', 'HR_MANAGER'] },
                       required: true,
                   }],
                   attributes: ['id'],
               });

               const adminIds = adminUsers
                   .map((u: any) => u.id)
                   .filter((id: string) => id !== req.user!.id);

               if (adminIds.length > 0) {
                   const employee = await db.User.findByPk(req.user!.id, { attributes: ['fullName'] });
                   await InternalNotifier.sendBulk({
                       businessId,
                       recipientUserIds: adminIds,
                       senderUserId:     req.user!.id,
                       moduleKey:        'hr',
                       type:             'exit_submitted',
                       title:            'New Offboarding Request',
                       message:          `${employee?.fullName || 'An employee'} has submitted an offboarding/resignation request. Last working day: ${new Date(effectiveDate).toLocaleDateString()}.`,
                       entityType:       'ExitProcess',
                       entityId:         String(ex.id),
                       priority:         'high',
                   });
               }
           } catch (notifErr) {
               console.error('[ExitProcess] Failed to send admin notifications:', notifErr);
           }

           successResponse(res, ex, 'Offboarding request submitted successfully.', 201);
       } catch (e: any) { errorResponse(res, e.message); }
   };

   updateExitStatus = async (req: Request, res: Response) => {
       try {
           const result = await this.service.processExit(req.user!.businessId, req.body.employeeUserId, req.params.id, req.body.status);
           await AuditLogService.log('UPDATED_EXIT_PROCESS', 'hr_exit_processes', String(result.id), null, { status: req.body.status }, req);
           successResponse(res, result);
       } catch (e: any) { errorResponse(res, e.message); }
   };
}
