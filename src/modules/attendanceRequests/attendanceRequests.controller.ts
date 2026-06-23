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
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

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

  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.body?.requestType === "check_in_correction") {
        const perms = new Set(req.user!.permissions || []);
        if (!req.user!.isPlatformSuperAdmin && !perms.has("attendance.checkin_correction.request") && !perms.has("attendance.manage")) {
          return next({ statusCode: 403, message: "Forbidden (permission)" });
        }
      }
      const perms = new Set(req.user!.permissions || []);
      const roles = new Set(req.user!.roles || []);
      const canManage = req.user!.isPlatformSuperAdmin || perms.has("attendance.manage") || roles.has("BUSINESS_ADMIN") || roles.has("HR_MANAGER");
      const record = await this.svc.create(req.user!.businessId, req.user!.id, req.body, { canManage });
      await AuditLogService.log("CREATE", "attendance_request", String(record.id), null, record, req);
      res.status(201).json({ attendanceRequest: record });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.assertCanAction(req, req.params.id);
      const record = await this.svc.action(req.user!.businessId, req.params.id, req.user!.id, "approved", req.body?.note || req.body?.comment);
      await AuditLogService.log("UPDATE", "attendance_request", req.params.id, null, { status: "approved" }, req);
      res.json({ attendanceRequest: record });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.assertCanAction(req, req.params.id);
      const record = await this.svc.action(req.user!.businessId, req.params.id, req.user!.id, "rejected", req.body?.reason || req.body?.comment);
      await AuditLogService.log("UPDATE", "attendance_request", req.params.id, null, { status: "rejected" }, req, "warning");
      res.json({ attendanceRequest: record });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  fixManualTimes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.svc.syncApprovedCorrections(req.user!.businessId, req.body || {});
      await AuditLogService.log("FIX_MANUAL_TIMES", "attendance_request", "approved_corrections", null, result, req);
      res.json({ success: true, message: "Manual attendance times fixed", data: result });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  listPendingLatenessNotices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const size = parseInt(req.query.size as string) || 20;
      const result = await this.svc.listPendingLatenessNotices(req.user!.businessId, { ...req.query, page, size });
      res.json({ rows: result.rows, total: result.count, page, size, totalPages: Math.ceil(result.count / size) });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  approveLatenessNotice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.assertCanAction(req, req.params.id);
      const record = await this.svc.action(req.user!.businessId, req.params.id, req.user!.id, "approved", req.body?.note || req.body?.comment);
      await AuditLogService.log("UPDATE", "lateness_notice", req.params.id, null, { status: "approved" }, req);
      res.json({ attendanceRequest: record });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  rejectLatenessNotice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.assertCanAction(req, req.params.id);
      const record = await this.svc.action(req.user!.businessId, req.params.id, req.user!.id, "rejected", req.body?.reason || req.body?.comment);
      await AuditLogService.log("UPDATE", "lateness_notice", req.params.id, null, { status: "rejected" }, req, "warning");
      res.json({ attendanceRequest: record });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  markInvalidLatenessNotice = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.assertCanAction(req, req.params.id);
      const record = await this.svc.action(req.user!.businessId, req.params.id, req.user!.id, "invalid", req.body?.reason || req.body?.comment);
      await AuditLogService.log("UPDATE", "lateness_notice", req.params.id, null, { status: "invalid" }, req, "warning");
      res.json({ attendanceRequest: record });
    } catch (err: any) {
      next({ statusCode: err.statusCode || 400, message: err.message });
    }
  };

  private assertCanAction = async (req: Request, requestId: string) => {
    await this.svc.findBasic(req.user!.businessId, requestId);
    const roles = new Set(req.user!.roles || []);
    const perms = new Set(req.user!.permissions || []);
    if (req.user!.isPlatformSuperAdmin) return;
    if (!roles.has("BUSINESS_ADMIN") && !roles.has("HR_MANAGER") && !perms.has("attendance.manage") && !perms.has("attendance.checkin_correction.approve")) {
      throw Object.assign(new Error("Attendance request approval requires HR or Business Admin approval."), { statusCode: 403 });
    }
  };
}
