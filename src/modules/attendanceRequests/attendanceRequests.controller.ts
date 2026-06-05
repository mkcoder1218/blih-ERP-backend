import type { Request, Response, NextFunction } from "express";
import { AuditLogService } from "../../services/auditLog.service";
import { AttendanceRequestsService } from "./attendanceRequests.service";

export class AttendanceRequestsController {
  private svc = new AttendanceRequestsService();

  listAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 20;
      const result = await this.svc.list(req.user!.businessId, { ...req.query, page, size });
      res.json({ rows: result.rows, total: result.count, page, size, totalPages: Math.ceil(result.count / size) });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };

  listMine = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 20;
      const result = await this.svc.list(req.user!.businessId, { ...req.query, page, size }, req.user!.id);
      res.json({ rows: result.rows, total: result.count, page, size, totalPages: Math.ceil(result.count / size) });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };

  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await this.svc.create(req.user!.businessId, req.user!.id, req.body);
      await AuditLogService.log("CREATE", "attendance_request", String(record.id), null, record, req);
      res.status(201).json({ attendanceRequest: record });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await this.svc.action(req.user!.businessId, req.params.id, req.user!.id, "approved", req.body?.note || req.body?.comment);
      await AuditLogService.log("UPDATE", "attendance_request", req.params.id, null, { status: "approved" }, req);
      res.json({ attendanceRequest: record });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await this.svc.action(req.user!.businessId, req.params.id, req.user!.id, "rejected", req.body?.reason || req.body?.comment);
      await AuditLogService.log("UPDATE", "attendance_request", req.params.id, null, { status: "rejected" }, req, "warning");
      res.json({ attendanceRequest: record });
    } catch (err: any) {
      next({ statusCode: 400, message: err.message });
    }
  };
}
