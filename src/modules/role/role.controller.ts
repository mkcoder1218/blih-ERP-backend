import type { Request, Response, NextFunction } from "express";
import { RoleService } from "./role.service";
import { AuditLogService } from "../../services/auditLog.service";

export class RoleController {
  private service: RoleService;

  constructor() {
    this.service = new RoleService();
  }

  list = async (req: Request, res: Response) => {
    const roles = await this.service.list(req.user!.businessId);
    res.json({ roles });
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    const role = await this.service.getById(req.params.id);
    if (!role) return next({ statusCode: 404, message: "Role not found" });
    if (!req.user!.isPlatformSuperAdmin && role.businessId !== req.user!.businessId) {
      return next({ statusCode: 403, message: "Forbidden (tenant)" });
    }
    res.json({ role });
  };

  create = async (req: Request, res: Response) => {
    const role = await this.service.create(req.user!.businessId, req.body);
    await AuditLogService.log("CREATE", "role", role.id, null, role, req);
    res.status(201).json({ role });
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    const beforeData = await this.service.getById(req.params.id);
    const role = await this.service.update(req.params.id, req.user!.businessId, req.body);
    if (!role) return next({ statusCode: 404, message: "Role not found" });
    await AuditLogService.log("UPDATE", "role", req.params.id, beforeData, role, req);
    res.json({ role });
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    const beforeData = await this.service.getById(req.params.id);
    const ok = await this.service.softDelete(req.params.id, req.user!.businessId);
    if (!ok) return next({ statusCode: 404, message: "Role not found" });
    await AuditLogService.log("DELETE", "role", req.params.id, beforeData, null, req);
    res.json({ ok: true });
  };
}

