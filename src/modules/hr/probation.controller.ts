import type {
  Request,
  Response,
} from "express";
import { AuditLogService } from "../../services/auditLog.service";
import {
  errorResponse,
  successResponse,
} from "../../utils/response";
import { ProbationService } from "./probation.service";
import { ProbationLifecycleService } from "./probation.lifecycle.service";

function resolveErrorStatus(
  message: string,
): number {
  if (
    message ===
      "Position not found." ||
    message ===
      "Employee record not found." ||
    message ===
      "Probation record not found."
  ) {
    return 404;
  }

  if (
    message.includes(
      "already has an open probation",
    )
  ) {
    return 409;
  }

  return 400;
}

export class ProbationController {
  private readonly service =
    new ProbationService();

  private readonly lifecycle =
    new ProbationLifecycleService();

  getPositionCompetencies = async (
    req: Request,
    res: Response,
  ) => {
    try {
      const data =
        await this.service.getPositionCompetencies(
          req.user!.businessId,
          req.params.positionId,
        );

      successResponse(res, data);
    } catch (error: any) {
      errorResponse(
        res,
        error.message,
        resolveErrorStatus(
          error.message,
        ),
      );
    }
  };

  replacePositionCompetencies =
    async (
      req: Request,
      res: Response,
    ) => {
      try {
        const data =
          await this.service.replacePositionCompetencies(
            req.user!.businessId,
            req.params.positionId,
            req.user!.id,
            req.body.competencies,
          );

        await AuditLogService.log(
          "REPLACED_POSITION_PROBATION_COMPETENCIES",
          "Position",
          req.params.positionId,
          null,
          {
            competencyCount:
              data.length,
          },
          req,
        );

        successResponse(
          res,
          data,
          "Position probation competencies updated.",
        );
      } catch (error: any) {
        errorResponse(
          res,
          error.message,
          resolveErrorStatus(
            error.message,
          ),
        );
      }
    };

  initialize = async (
    req: Request,
    res: Response,
  ) => {
    try {
      const data =
        await this.service.initialize(
          req.user!.businessId,
          req.user!.id,
          req.body,
        );

      await AuditLogService.log(
        "INITIALIZED_EMPLOYEE_PROBATION",
        "EmployeeProbation",
        String(data.id),
        null,
        {
          employeeUserId:
            data.employeeUserId,
          startDate:
            data.startDate,
          expectedEndDate:
            data.expectedEndDate,
          source: data.source,
        },
        req,
      );

      successResponse(
        res,
        data,
        "Employee probation initialized.",
        201,
      );
    } catch (error: any) {
      errorResponse(
        res,
        error.message,
        resolveErrorStatus(
          error.message,
        ),
      );
    }
  };

  list = async (
    req: Request,
    res: Response,
  ) => {
    try {
      const data =
        await this.service.list(
          req.user!.businessId,
          req.query,
        );

      successResponse(res, data);
    } catch (error: any) {
      errorResponse(
        res,
        error.message,
        resolveErrorStatus(
          error.message,
        ),
      );
    }
  };

  getById = async (
    req: Request,
    res: Response,
  ) => {
    try {
      const data =
        await this.service.getById(
          req.user!.businessId,
          req.params.probationId,
        );

      successResponse(res, data);
    } catch (error: any) {
      errorResponse(
        res,
        error.message,
        resolveErrorStatus(
          error.message,
        ),
      );
    }
  };


  submitManagerReview = async (req: Request, res: Response) => {
    try {
      const data = await this.lifecycle.submitManagerReview(
        req.user!.businessId,
        req.user!.id,
        req.params.probationId,
        req.body,
      );
      await AuditLogService.log(
        "SUBMITTED_PROBATION_MANAGER_REVIEW",
        "EmployeeProbation",
        req.params.probationId,
        null,
        { recommendation: req.body.recommendation },
        req,
      );
      successResponse(res, data, "Manager review submitted.");
    } catch (error: any) {
      errorResponse(res, error.message, resolveErrorStatus(error.message));
    }
  };

  submitHrReview = async (req: Request, res: Response) => {
    try {
      const data = await this.lifecycle.submitHrReview(
        req.user!.businessId,
        req.user!.id,
        req.params.probationId,
        req.body,
      );
      await AuditLogService.log(
        "SUBMITTED_PROBATION_HR_REVIEW",
        "EmployeeProbation",
        req.params.probationId,
        null,
        { recommendation: req.body.recommendation },
        req,
      );
      successResponse(res, data, "HR review submitted.");
    } catch (error: any) {
      errorResponse(res, error.message, resolveErrorStatus(error.message));
    }
  };

  makeFinalDecision = async (req: Request, res: Response) => {
    try {
      const data = await this.lifecycle.makeFinalDecision(
        req.user!.businessId,
        req.user!.id,
        req.params.probationId,
        req.body,
      );
      await AuditLogService.log(
        "APPROVED_PROBATION_FINAL_DECISION",
        "EmployeeProbation",
        req.params.probationId,
        null,
        { decision: req.body.decision, childProbationId: data.childProbationId },
        req,
      );
      successResponse(res, data, "Final probation decision completed.");
    } catch (error: any) {
      errorResponse(res, error.message, resolveErrorStatus(error.message));
    }
  };

  acknowledge = async (req: Request, res: Response) => {
    try {
      const data = await this.lifecycle.acknowledge(
        req.user!.businessId,
        req.user!.id,
        req.params.probationId,
      );
      successResponse(res, data, "Probation decision acknowledged.");
    } catch (error: any) {
      errorResponse(res, error.message, resolveErrorStatus(error.message));
    }
  };

  getMine = async (req: Request, res: Response) => {
    try {
      const data = await this.lifecycle.myProbation(
        req.user!.businessId,
        req.user!.id,
      );
      successResponse(res, data);
    } catch (error: any) {
      errorResponse(res, error.message, resolveErrorStatus(error.message));
    }
  };

}
