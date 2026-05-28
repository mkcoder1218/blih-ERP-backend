import type { Request, Response, NextFunction } from "express";
import { RoleService } from "./role.service";
import { AuditLogService } from "../../services/auditLog.service";
import { ok } from "../../utils/apiResponse";

export class RoleController {
  private service: RoleService;

  constructor() {
    this.service = new RoleService();
  }

  list = async (req: Request, res: Response) => {
    let businessId: string | undefined = req.user!.businessId;
    
    if (req.user!.isPlatformSuperAdmin) {
      // Super admin can filter by businessId or see all if not provided
      businessId = (req.query.businessId as string) || undefined;
    }

    const roles = await this.service.list(businessId);
    return ok(res, { roles, count: roles.length }, "Roles list");
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    const role = await this.service.getById(req.params.id);
    if (!role) return next({ statusCode: 404, message: "Role not found" });
    if (!req.user!.isPlatformSuperAdmin && role.businessId !== req.user!.businessId) {
      return next({ statusCode: 403, message: "Forbidden (tenant)" });
    }
    return ok(res, { role }, "Role details");
  };

  create = async (req: Request, res: Response) => {
    const role = await this.service.create(req.user!.businessId, req.body);
    await AuditLogService.log("CREATE", "role", role.id, null, role, req);
    return ok(res, { role }, "Role created", 201);
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    const beforeData = await this.service.getById(req.params.id);
    const role = await this.service.update(req.params.id, req.user!.businessId, req.body);
    if (!role) return next({ statusCode: 404, message: "Role not found" });
    await AuditLogService.log("UPDATE", "role", req.params.id, beforeData, role, req);
    return ok(res, { role }, "Role updated");
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    const beforeData = await this.service.getById(req.params.id);
    const okFlag = await this.service.softDelete(req.params.id, req.user!.businessId);
    if (!okFlag) return next({ statusCode: 404, message: "Role not found" });
    await AuditLogService.log("DELETE", "role", req.params.id, beforeData, null, req);
    return ok(res, { ok: true }, "Role removed");
  };
}

