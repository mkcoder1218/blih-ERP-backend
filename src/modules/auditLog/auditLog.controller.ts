import type { Request, Response, NextFunction } from "express";
import { AuditLogServiceRead } from "./auditLog.service";

export class AuditLogController {
  private service = new AuditLogServiceRead();

  list = async (req: Request, res: Response) => {
    const isSuperAdmin = req.user!.isPlatformSuperAdmin;

    // Super admin can query across all businesses or filter by one
    // Business admin is locked to their own businessId
    const businessId = isSuperAdmin
      ? (req.query.businessId as string | undefined)
      : req.user!.businessId;

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const size = Math.min(100, Math.max(1, parseInt(req.query.size as string) || 20));

    const { count, rows } = await this.service.listPaginated({
      businessId,
      userId: req.query.userId as string | undefined,
      action: req.query.action as string | undefined,
      entityType: req.query.entityType as string | undefined,
      category: req.query.category as string | undefined,
      search: req.query.search as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      page,
      size,
    });

    res.json({
      logs: rows,
      total: count,
      page,
      size,
      totalPages: Math.ceil(count / size),
    });
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    const log = await this.service.getById(req.params.id);
    if (!log) return next({ statusCode: 404, message: "Audit log not found" });

    // Non-super-admin can only read their own business logs
    if (!req.user!.isPlatformSuperAdmin && log.businessId !== req.user!.businessId) {
      return next({ statusCode: 403, message: "Forbidden" });
    }

    res.json({ log });
  };
}
