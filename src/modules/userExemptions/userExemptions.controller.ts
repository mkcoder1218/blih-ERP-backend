import type { Request, Response, NextFunction } from "express";
import { AuditLogService } from "../../services/auditLog.service";
import { UserExemptionsService } from "./userExemptions.service";

export class UserExemptionsController {
  private svc = new UserExemptionsService();

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 20;
      const result = await this.svc.list(req.user!.businessId, { ...req.query, page, size });
      res.json({ rows: result.rows, total: result.count, page, size, totalPages: Math.ceil(result.count / size) });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await this.svc.create(req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log("CREATE", "user_exemption", String(record.id), null, record, req);
      res.status(201).json({ userExemption: record });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await this.svc.approve(req.user!.businessId, req.params.id, req.user!.id);
      await AuditLogService.log("APPROVE", "user_exemption", req.params.id, null, record, req);
      res.json({ userExemption: record });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await this.svc.reject(req.user!.businessId, req.params.id, req.user!.id);
      await AuditLogService.log("REJECT", "user_exemption", req.params.id, null, record, req, "warning");
      res.json({ userExemption: record });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };
}
