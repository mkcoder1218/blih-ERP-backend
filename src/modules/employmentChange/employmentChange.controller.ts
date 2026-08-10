import type { NextFunction, Request, Response } from "express";
import { AuditLogService } from "../../services/auditLog.service";
import { EmploymentChangeContextService } from "./employmentChange.context.service";
import { EmploymentChangeService } from "./employmentChange.service";
import { EmploymentChangeSubmissionPolicy } from "./employmentChange.submission-policy";

export class EmploymentChangeController {
  private service = new EmploymentChangeService();
  private contextService = new EmploymentChangeContextService();
  private submissionPolicy = new EmploymentChangeSubmissionPolicy();

  context = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = await this.contextService.get(
        req.user!.businessId,
        req.user!.id,
        req.query.employeeUserId ? String(req.query.employeeUserId) : undefined,
      );
      res.json({ context });
    } catch (error: any) {
      next({ statusCode: error.statusCode || 400, message: error.message });
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await this.service.list(req.user!.businessId, req.user!.id, req.query);
      res.json({ rows });
    } catch (error: any) {
      next({ statusCode: error.statusCode || 400, message: error.message });
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const request = await this.service.get(req.user!.businessId, req.user!.id, req.params.id);
      res.json({ request });
    } catch (error: any) {
      next({ statusCode: error.statusCode || 400, message: error.message });
    }
  };

  history = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await this.service.history(req.user!.businessId, req.user!.id, req.params.id);
      res.json({ rows });
    } catch (error: any) {
      next({ statusCode: error.statusCode || 400, message: error.message });
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.submissionPolicy.validate(req.user!.businessId, req.user!.id, req.body);
      const request = await this.service.create(req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log(
        "CREATE_EMPLOYMENT_CHANGE_REQUEST",
        "employment_change_request",
        String(request.id),
        null,
        request,
        req,
      );
      res.status(201).json({ request });
    } catch (error: any) {
      next({ statusCode: error.statusCode || 400, message: error.message });
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const request = await this.service.approve(
        req.user!.businessId,
        req.user!.id,
        req.params.id,
        req.body?.comment,
      );
      await AuditLogService.log(
        "APPROVE_EMPLOYMENT_CHANGE_STAGE",
        "employment_change_request",
        String(request.id),
        null,
        request,
        req,
      );
      res.json({ request });
    } catch (error: any) {
      next({ statusCode: error.statusCode || 400, message: error.message });
    }
  };

  counter = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const current = await this.service.get(
        req.user!.businessId,
        req.user!.id,
        req.params.id,
      );

      if (!current.canCounter) {
        throw Object.assign(
          new Error("This request is not awaiting your salary review."),
          { statusCode: 403 },
        );
      }

      const request = await this.service.counter(
        req.user!.businessId,
        req.user!.id,
        req.params.id,
        Number(req.body?.recommendedSalary),
        String(req.body?.comment || ""),
      );
      await AuditLogService.log(
        "COUNTER_EMPLOYMENT_SALARY_CHANGE",
        "employment_change_request",
        String(request.id),
        null,
        request,
        req,
      );
      res.json({ request });
    } catch (error: any) {
      next({ statusCode: error.statusCode || 400, message: error.message });
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const request = await this.service.reject(
        req.user!.businessId,
        req.user!.id,
        req.params.id,
        String(req.body?.reason || req.body?.comment || ""),
      );
      await AuditLogService.log(
        "REJECT_EMPLOYMENT_CHANGE_REQUEST",
        "employment_change_request",
        String(request.id),
        null,
        request,
        req,
      );
      res.json({ request });
    } catch (error: any) {
      next({ statusCode: error.statusCode || 400, message: error.message });
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const request = await this.service.cancel(
        req.user!.businessId,
        req.user!.id,
        req.params.id,
        req.body?.reason,
      );
      await AuditLogService.log(
        "CANCEL_EMPLOYMENT_CHANGE_REQUEST",
        "employment_change_request",
        String(request.id),
        null,
        request,
        req,
      );
      res.json({ request });
    } catch (error: any) {
      next({ statusCode: error.statusCode || 400, message: error.message });
    }
  };
}
