
import type { Request, Response } from 'express';
import { RecruitmentService } from './recruitment.service';
import { errorResponse, successResponse, paginationResponse } from '../../utils/response';
import { AuditLogService } from '../../services/auditLog.service';
import { db } from '../../models';

export class RecruitmentController {
   private service = new RecruitmentService();

   seedForms = async (req: Request, res: Response) => {
     await this.service.provisionForms(req.user!.businessId);
     successResponse(res, null, "Recruitment templates seeded.");
   };

   // Public Apply
   publicApply = async (req: Request, res: Response) => {
     try {
       const app = await this.service.publicApply(req.params.jobOpeningId, req.body);
       // Do not bind AuditLogService mapping heavily due to absent Request User mapping structurally
       successResponse(res, { jobApplicationId: app.id }, "Application received.", 201);
     } catch (e: any) { errorResponse(res, e.message); }
   };

   listOpenings = async (req: Request, res: Response) => {
       try {
           const limit = Number(req.query.limit || 20);
           const offset = Number(req.query.offset || 0);
           const q: any = { businessId: req.user!.businessId };
           const result = await db.JobOpening.findAndCountAll({ where: q, limit, offset });
           paginationResponse(res, result.rows, result.count, offset/limit + 1, limit);
       } catch (e: any) { errorResponse(res, e.message); }
   };

   createOpening = async (req: Request, res: Response) => {
       try {
           const opening = await db.JobOpening.create({ ...req.body, businessId: req.user!.businessId, requestedByUserId: req.user!.id });
           await AuditLogService.log('CREATED_JOB_OPENING', 'hr_job_openings', String(opening.id), null, {}, req);
           successResponse(res, opening, "Job opening defined.", 201);
       } catch (e: any) { errorResponse(res, e.message); }
   };

   advanceApplicant = async (req: Request, res: Response) => {
       try {
           const { stage } = req.body;
           const result = await this.service.advanceApplicant(req.params.id, req.user!.businessId, stage);
           await AuditLogService.log('ADVANCED_APPLICANT', 'hr_job_applications', String(result.id), null, { stage }, req);
           successResponse(res, result);
       } catch (e: any) { errorResponse(res, e.message); }
   };
}
