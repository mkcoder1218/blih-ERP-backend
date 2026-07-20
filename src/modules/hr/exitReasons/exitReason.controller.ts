import type {
  Request,
  Response,
} from "express";
import { AuditLogService } from "../../../services/auditLog.service";
import {
  errorResponse,
  successResponse,
} from "../../../utils/response";
import { ExitReasonService } from "./exitReason.service";
import {
  validateCreateExitReason,
  validateReorderExitReasons,
  validateUpdateExitReason,
} from "./exitReason.validation";

export class ExitReasonController {
  private readonly service =
    new ExitReasonService();

  list = async (
    req: Request,
    res: Response,
  ) => {
    try {
      const isManager =
        req.user?.permissions?.includes(
          "hr.write",
        ) ||
        req.user?.permissions?.includes(
          "hr.read",
        );

      const rows =
        await this.service.list(
          req.user!.businessId,
          {
            initiator:
              String(
                req.query.initiator ||
                  "",
              ) || undefined,

            includeInactive:
              isManager &&
              String(
                req.query.includeInactive,
              ) === "true",
          },
        );

      successResponse(res, rows);
    } catch (error: any) {
      errorResponse(
        res,
        error.message,
        400,
      );
    }
  };

  create = async (
    req: Request,
    res: Response,
  ) => {
    try {
      const input =
        validateCreateExitReason(
          req.body,
        );

      const reason =
        await this.service.create(
          req.user!.businessId,
          req.user!.id,
          input,
        );

      await AuditLogService.log(
        "CREATE_EXIT_REASON",
        "hr_exit_reasons",
        String(reason.id),
        null,
        reason.toJSON(),
        req,
      );

      successResponse(
        res,
        reason,
        "Exit reason created successfully.",
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

  update = async (
    req: Request,
    res: Response,
  ) => {
    try {
      const before =
        await this.service.findById(
          req.user!.businessId,
          req.params.id,
        );

      const input =
        validateUpdateExitReason(
          req.body,
        );

      const reason =
        await this.service.update(
          req.user!.businessId,
          req.params.id,
          input,
        );

      await AuditLogService.log(
        "UPDATE_EXIT_REASON",
        "hr_exit_reasons",
        String(reason.id),
        before.toJSON(),
        reason.toJSON(),
        req,
      );

      successResponse(
        res,
        reason,
        "Exit reason updated successfully.",
      );
    } catch (error: any) {
      const statusCode =
        error.message ===
        "Exit reason not found."
          ? 404
          : 400;

      errorResponse(
        res,
        error.message,
        statusCode,
      );
    }
  };

  remove = async (
    req: Request,
    res: Response,
  ) => {
    try {
      const before =
        await this.service.findById(
          req.user!.businessId,
          req.params.id,
        );

      const result =
        await this.service.remove(
          req.user!.businessId,
          req.params.id,
        );

      await AuditLogService.log(
        "DELETE_EXIT_REASON",
        "hr_exit_reasons",
        req.params.id,
        before.toJSON(),
        result,
        req,
      );

      successResponse(
        res,
        result,
        result.deleted
          ? "Exit reason deleted successfully."
          : "Exit reason is already in use and was disabled instead.",
      );
    } catch (error: any) {
      const statusCode =
        error.message ===
        "Exit reason not found."
          ? 404
          : 400;

      errorResponse(
        res,
        error.message,
        statusCode,
      );
    }
  };

  reorder = async (
    req: Request,
    res: Response,
  ) => {
    try {
      const rows =
        validateReorderExitReasons(
          req.body,
        );

      const result =
        await this.service.reorder(
          req.user!.businessId,
          rows,
        );

      await AuditLogService.log(
        "REORDER_EXIT_REASONS",
        "hr_exit_reasons",
        '',
        null,
        { rows },
        req,
      );

      successResponse(
        res,
        result,
        "Exit reasons reordered successfully.",
      );
    } catch (error: any) {
      errorResponse(
        res,
        error.message,
        400,
      );
    }
  };
}
