
import type { Request, Response } from 'express';
import { HRPerformanceService } from './performance.service';
import { errorResponse, successResponse, paginationResponse } from '../../utils/response';
import { AuditLogService } from '../../services/auditLog.service';
import { db } from '../../models';

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
           // Employee submits for self
           if (!payload.employeeUserId) payload.employeeUserId = req.user!.id;
           if (!payload.requestedByUserId) payload.requestedByUserId = req.user!.id;
           
           const r = await db.TrainingRecord.create(payload);
           await AuditLogService.log('CREATED_TRAINING', 'hr_training_records', String(r.id), null, {}, req);
           successResponse(res, r, "Training mapping defined.", 201);
       } catch (e: any) { errorResponse(res, e.message); }
   };

   // Disciplinary Restrictions
   listDisciplinary = async (req: Request, res: Response) => {
       try {
           // Enforce Role bounds strictly avoiding standard "my team" leakage for grievance paths internally via Service Logic Checks.
           await this.service.restrictDisciplinaryAccess(req.user!.businessId, req.user);
           
           const limit = Number(req.query.limit || 20);
           const offset = Number(req.query.offset || 0);
           const result = await db.DisciplinaryCase.findAndCountAll({ where: { businessId: req.user!.businessId }, limit, offset });
           paginationResponse(res, result.rows, result.count, offset/limit + 1, limit);
       } catch (e: any) { errorResponse(res, e.message, 403); }
   };

   // Exit Workflow
   submitResignation = async (req: Request, res: Response) => {
       try {
           const { effectiveDate, reason } = req.body;
           const ex = await db.ExitProcess.create({
               businessId: req.user!.businessId,
               initiatedByUserId: req.user!.id,
               employeeUserId: req.user!.id,
               exitType: 'resignation',
               effectiveDate,
               reason
           });
           await AuditLogService.log('SUBMIT_RESIGNATION', 'hr_exit_processes', String(ex.id), null, {}, req);
           successResponse(res, ex, "Resignation structured.", 201);
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
