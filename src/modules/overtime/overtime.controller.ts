import type { Request, Response, NextFunction } from "express";
import { OvertimeService, ROLE_STAGE_MAP } from "./overtime.service";
import { AuditLogService } from "../../services/auditLog.service";

export class OvertimeController {
  private svc = new OvertimeService();

  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await this.svc.submit(req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log("CREATE", "overtime_request", record.id, null, record, req);
      res.status(201).json({ overtimeRequest: record });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };

  listMine = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    const result = await this.svc.listForEmployee(req.user!.businessId, req.user!.id, {
      status: req.query.status as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      page,
      size,
    });
    res.json({ rows: result.rows, total: result.count, page, size, totalPages: Math.ceil(result.count / size) });
  };

  cancel = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await this.svc.cancel(req.params.id, req.user!.businessId, req.user!.id);
      await AuditLogService.log("UPDATE", "overtime_request", req.params.id, null, { status: "cancelled" }, req);
      res.json({ overtimeRequest: record });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };

  listAll = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    const result = await this.svc.listAll(req.user!.businessId, {
      status: req.query.status as string | undefined,
      approvalStage: req.query.approvalStage as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      page,
      size,
    });
    res.json({ rows: result.rows, total: result.count, page, size, totalPages: Math.ceil(result.count / size) });
  };

  listPending = async (req: Request, res: Response, next: NextFunction) => {
    const stage = this._resolveStage(req);
    if (!stage) return next({ statusCode: 403, message: "Your role cannot view pending overtime requests" });
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    const result = await this.svc.listPendingForStage(req.user!.businessId, stage, {
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      page,
      size,
    });
    res.json({ rows: result.rows, total: result.count, page, size, totalPages: Math.ceil(result.count / size), stage });
  };

  listActive = async (req: Request, res: Response, next: NextFunction) => {
    if (!this._resolveStage(req)) return next({ statusCode: 403, message: "Your role cannot view active overtime requests" });
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    const result = await this.svc.listActiveApproved(req.user!.businessId, {
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      page,
      size,
    });
    res.json({ rows: result.rows, total: result.count, page, size, totalPages: Math.ceil(result.count / size) });
  };

  listClosed = async (req: Request, res: Response, next: NextFunction) => {
    if (!this._resolveStage(req)) return next({ statusCode: 403, message: "Your role cannot view closed overtime history" });
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    const result = await this.svc.listClosedHistory(req.user!.businessId, {
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      page,
      size,
    });
    res.json({ rows: result.rows, total: result.count, page, size, totalPages: Math.ceil(result.count / size) });
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    const record = await this.svc.getById(req.params.id, req.user!.businessId);
    if (!record) return next({ statusCode: 404, message: "Not found" });
    res.json({ overtimeRequest: record });
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stage = this._resolveStage(req);
      if (!stage) return next({ statusCode: 403, message: "Your role cannot approve overtime requests" });
      const record = await this.svc.approve(req.params.id, req.user!.businessId, req.user!.id, stage, req.body.comment);
      await AuditLogService.log("UPDATE", "overtime_request", req.params.id, null, { action: "approved", status: "approved" }, req);
      res.json({ overtimeRequest: record });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stage = this._resolveStage(req);
      if (!stage) return next({ statusCode: 403, message: "Your role cannot reject overtime requests" });
      const record = await this.svc.reject(req.params.id, req.user!.businessId, req.user!.id, stage, req.body.reason || req.body.comment);
      await AuditLogService.log("UPDATE", "overtime_request", req.params.id, null, { action: "rejected", status: "rejected" }, req, "warning");
      res.json({ overtimeRequest: record });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };

  close = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!this._resolveStage(req)) return next({ statusCode: 403, message: "Your role cannot close overtime requests" });
      const record = await this.svc.close(req.params.id, req.user!.businessId, req.user!.id);
      await AuditLogService.log("UPDATE", "overtime_request", req.params.id, null, { action: "closed", status: "closed" }, req);
      res.json({ overtimeRequest: record });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };

  private _resolveStage(req: Request): string | null {
    const roles: string[] = req.user!.roles || [];
    for (const role of roles) {
      const stage = ROLE_STAGE_MAP[role.toUpperCase()];
      if (stage) return stage;
    }
    if (req.user!.isPlatformSuperAdmin) return "admin";
    return null;
  }
}
