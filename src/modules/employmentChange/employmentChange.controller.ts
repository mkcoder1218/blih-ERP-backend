import type { NextFunction, Request, Response } from "express";
import { AuditLogService } from "../../services/auditLog.service";
import { EmploymentChangeContextService } from "./employmentChange.context.service";
import { EmploymentChangeManagementService } from "./employmentChange.management.service";
import { EmploymentChangeRequest } from "./employmentChange.models";
import { EmploymentChangeSalaryService } from "./employmentChange.salary.service";
import { EmploymentChangeService } from "./employmentChange.service";
import { EmploymentChangeSubmissionPolicy } from "./employmentChange.submission-policy";
import { EmploymentChangeUpdateService } from "./employmentChange.update.service";

export class EmploymentChangeController {
  private service = new EmploymentChangeService();
  private managementService = new EmploymentChangeManagementService();
  private contextService = new EmploymentChangeContextService();
  private submissionPolicy = new EmploymentChangeSubmissionPolicy();
  private updateService = new EmploymentChangeUpdateService();
  private salaryService = new EmploymentChangeSalaryService();

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

  analytics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const analytics = await this.managementService.analytics(
        req.user!.businessId,
        req.user!.id,
      );
      res.json({ analytics });
    } catch (error: any) {
      next({ statusCode: error.statusCode || 400, message: error.message });
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.managementService.list(
        req.user!.businessId,
        req.user!.id,
        req.query,
      );
      const rows = await this.salaryService.enrichMany(
        req.user!.businessId,
        result.rows,
      );
      res.json({ ...result, rows });
    } catch (error: any) {
      next({ statusCode: error.statusCode || 400, message: error.message });
    }
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const request = await this.service.get(
        req.user!.businessId,
        req.user!.id,
        req.params.id,
      );
      res.json({
        request: await this.salaryService.enrich(
          req.user!.businessId,
          request,
        ),
      });
    } catch (error: any) {
      next({ statusCode: error.statusCode || 400, message: error.message });
    }
  };

  history = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await this.service.history(
        req.user!.businessId,
        req.user!.id,
        req.params.id,
      );
      res.json({ rows });
    } catch (error: any) {
      next({ statusCode: error.statusCode || 400, message: error.message });
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.submissionPolicy.validate(
        req.user!.businessId,
        req.user!.id,
        req.body,
      );
      const request = await this.service.create(
        req.user!.businessId,
        req.user!.id,
        req.body,
      );
      await AuditLogService.log(
        "CREATE_EMPLOYMENT_CHANGE_REQUEST",
        "employment_change_request",
        String(request.id),
        null,
        request,
        req,
      );
      res.status(201).json({
        request: await this.salaryService.enrich(
          req.user!.businessId,
          request,
        ),
      });
    } catch (error: any) {
      next({ statusCode: error.statusCode || 400, message: error.message });
    }
  };

  updateOwn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.updateService.updateOwn(
        req.user!.businessId,
        req.user!.id,
        req.params.id,
        req.body,
      );

      const request = await this.service.get(
        req.user!.businessId,
        req.user!.id,
        req.params.id,
      );

      await AuditLogService.log(
        "UPDATE_OWN_EMPLOYMENT_CHANGE_REQUEST",
        "employment_change_request",
        String(req.params.id),
        result.before,
        request,
        req,
      );

      res.json({
        request: await this.salaryService.enrich(
          req.user!.businessId,
          request,
        ),
      });
    } catch (error: any) {
      next({ statusCode: error.statusCode || 400, message: error.message });
    }
  };

  immediateTitle = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.managementService.immediateTitleChange(
        req.user!.businessId,
        req.user!.id,
        req.body,
      );
      await AuditLogService.log(
        "APPLY_IMMEDIATE_TITLE_CHANGE",
        "employment_change_request",
        String(result.request.id),
        null,
        result,
        req,
      );
      res.status(201).json(result);
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
      res.json({
        request: await this.salaryService.enrich(
          req.user!.businessId,
          request,
        ),
      });
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

      const recommendedSalary = Number(req.body?.recommendedSalary);
      const currentSalary = Number(current.currentSalary || 0);
      if (!Number.isFinite(recommendedSalary) || recommendedSalary <= 0) {
        throw Object.assign(
          new Error("Recommended salary must be a positive number."),
          { statusCode: 400 },
        );
      }
      if (recommendedSalary <= currentSalary) {
        throw Object.assign(
          new Error(
            "Recommended salary must remain greater than the employee's current salary.",
          ),
          { statusCode: 400 },
        );
      }

      const request = await this.service.counter(
        req.user!.businessId,
        req.user!.id,
        req.params.id,
        recommendedSalary,
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
      res.json({
        request: await this.salaryService.enrich(
          req.user!.businessId,
          request,
        ),
      });
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
      res.json({
        request: await this.salaryService.enrich(
          req.user!.businessId,
          request,
        ),
      });
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
      res.json({
        request: await this.salaryService.enrich(
          req.user!.businessId,
          request,
        ),
      });
    } catch (error: any) {
      next({ statusCode: error.statusCode || 400, message: error.message });
    }
  };

  deleteOwn = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const request = await EmploymentChangeRequest.findOne({
        where: {
          id: req.params.id,
          businessId: req.user!.businessId,
        },
      });

      if (!request) {
        throw Object.assign(
          new Error("Employment change request not found."),
          { statusCode: 404 },
        );
      }

      if (String(request.requestedByUserId) !== String(req.user!.id)) {
        throw Object.assign(
          new Error("You can only delete requests you created."),
          { statusCode: 403 },
        );
      }

      if (!["PENDING", "CANCELLED"].includes(String(request.status))) {
        throw Object.assign(
          new Error("Only pending or cancelled requests can be deleted."),
          { statusCode: 409 },
        );
      }

      const before = request.toJSON();
      await request.destroy();

      await AuditLogService.log(
        "DELETE_OWN_EMPLOYMENT_CHANGE_REQUEST",
        "employment_change_request",
        String(request.id),
        before,
        { deleted: true },
        req,
      );

      res.json({ deleted: true, id: String(request.id) });
    } catch (error: any) {
      next({ statusCode: error.statusCode || 400, message: error.message });
    }
  };
}
