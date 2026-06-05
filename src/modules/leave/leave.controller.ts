import type { Request, Response, NextFunction } from "express";
import { LeaveService, LEAVE_ROLE_STAGE_MAP } from "./leave.service";
import { AuditLogService } from "../../services/auditLog.service";

export class LeaveController {
  private svc = new LeaveService();

  // ── Templates ─────────────────────────────────────────────────────────────

  listTemplates = async (req: Request, res: Response) => {
    const onlyActive = req.query.onlyActive === "true";
    const templates = await this.svc.listTemplates(req.user!.businessId, onlyActive);
    res.json({ templates });
  };

  createTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tpl = await this.svc.createTemplate(req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log("CREATE", "leave_template", tpl.id, null, tpl, req);
      res.status(201).json({ template: tpl });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };

  updateTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tpl = await this.svc.updateTemplate(req.params.id, req.user!.businessId, req.body);
      await AuditLogService.log("UPDATE", "leave_template", req.params.id, null, req.body, req);
      res.json({ template: tpl });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };

  toggleTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tpl = await this.svc.toggleTemplate(req.params.id, req.user!.businessId);
      await AuditLogService.log("UPDATE", "leave_template", req.params.id, null, { isActive: tpl.isActive }, req);
      res.json({ template: tpl });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };

  deleteTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.svc.deleteTemplate(req.params.id, req.user!.businessId);
      await AuditLogService.log("DELETE", "leave_template", req.params.id, null, null, req);
      res.json({ success: true });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };

  // ── Leave Requests ─────────────────────────────────────────────────────────

  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await this.svc.submit(req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log("CREATE", "leave_request", record.id, null, record, req);
      res.status(201).json({ leaveRequest: record });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };

  listMine = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    const result = await this.svc.listForEmployee(req.user!.businessId, req.user!.id, {
      status: req.query.status as string | undefined,
      page,
      size,
    });
    res.json({ rows: result.rows, total: result.count, page, size, totalPages: Math.ceil(result.count / size) });
  };

  listAll = async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    const result = await this.svc.listAll(req.user!.businessId, {
      status:      req.query.status as string | undefined,
      leaveType:   req.query.leaveType as string | undefined,
      approvalStage: req.query.approvalStage as string | undefined,
      dateFrom:    req.query.dateFrom as string | undefined,
      dateTo:      req.query.dateTo as string | undefined,
      page,
      size,
    });
    res.json({ rows: result.rows, total: result.count, page, size, totalPages: Math.ceil(result.count / size) });
  };

  listPending = async (req: Request, res: Response) => {
    const stage = this._resolveStage(req);
    if (!stage) { res.json({ rows: [], total: 0, page: 1, size: 20, totalPages: 0 }); return; }
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    const result = await this.svc.listPendingForStage(req.user!.businessId, stage, { page, size });
    res.json({ rows: result.rows, total: result.count, page, size, totalPages: Math.ceil(result.count / size), stage });
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    const record = await this.svc.getById(req.params.id, req.user!.businessId);
    if (!record) return next({ statusCode: 404, message: "Not found" });
    res.json({ leaveRequest: record });
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stage = this._resolveStage(req);
      if (!stage) return next({ statusCode: 403, message: "Your role cannot approve leave requests" });
      const record = await this.svc.approve(req.params.id, req.user!.businessId, req.user!.id, stage, req.body.comment);
      await AuditLogService.log("UPDATE", "leave_request", req.params.id, null, { stage, action: "approved" }, req);
      res.json({ leaveRequest: record });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stage = this._resolveStage(req);
      if (!stage) return next({ statusCode: 403, message: "Your role cannot reject leave requests" });
      const record = await this.svc.reject(req.params.id, req.user!.businessId, req.user!.id, stage, req.body.reason || req.body.comment);
      await AuditLogService.log("UPDATE", "leave_request", req.params.id, null, { stage, action: "rejected" }, req, "warning");
      res.json({ leaveRequest: record });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };

  cancel = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await this.svc.cancel(req.params.id, req.user!.businessId, req.user!.id);
      await AuditLogService.log("UPDATE", "leave_request", req.params.id, null, { status: "cancelled" }, req);
      res.json({ leaveRequest: record });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };

  getMyBalances = async (req: Request, res: Response) => {
    const balances = await this.svc.getBalances(req.user!.businessId, req.user!.id);
    res.json({ balances });
  };

  // ── Private ───────────────────────────────────────────────────────────────

  private _resolveStage(req: Request): string | null {
    const roles: string[] = req.user!.roles || [];
    for (const role of roles) {
      const stage = LEAVE_ROLE_STAGE_MAP[role.toUpperCase()];
      if (stage) return stage;
    }
    if (req.user!.isPlatformSuperAdmin) return "admin";
    return null;
  }
}
