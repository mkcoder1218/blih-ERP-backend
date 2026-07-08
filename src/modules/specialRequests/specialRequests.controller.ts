import type { NextFunction, Request, Response } from "express";
import { AuditLogService } from "../../services/auditLog.service";
import { SpecialRequestsService } from "./specialRequests.service";

export class SpecialRequestsController {
  private svc = new SpecialRequestsService();

  listMine = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 20;
      const result = await this.svc.list(req.user!.businessId, { ...req.query, page, size }, req.user!.id);
      res.json({ rows: result.rows, total: result.count, page, size, totalPages: Math.ceil(result.count / size) });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  listAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 20;
      const result = await this.svc.list(req.user!.businessId, { ...req.query, page, size });
      res.json({ rows: result.rows, total: result.count, page, size, totalPages: Math.ceil(result.count / size) });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const roles = new Set(req.user!.roles || []);
      const autoApprove = req.user!.isPlatformSuperAdmin || roles.has("HR_MANAGER");
      const record = await this.svc.create(req.user!.businessId, req.user!.id, req.body, { autoApprove });
      await AuditLogService.log("CREATE", "special_request", String(record.id), null, record, req);
      res.status(201).json({ specialRequest: record });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await this.svc.approve(req.user!.businessId, req.params.id, req.user!.id);
      await AuditLogService.log("UPDATE", "special_request", req.params.id, null, { status: "approved" }, req);
      res.json({ specialRequest: record });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await this.svc.reject(req.user!.businessId, req.params.id, req.user!.id, req.body?.reason);
      await AuditLogService.log("UPDATE", "special_request", req.params.id, null, { status: "rejected" }, req, "warning");
      res.json({ specialRequest: record });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };
}
