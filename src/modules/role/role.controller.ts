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
      businessId = (req.query.businessId as string) || undefined;
    }
    const roles = await this.service.list(businessId);
    return ok(res, { roles, count: roles.length }, "Roles list");
  };

  listMyDomain = async (req: Request, res: Response) => {
    const callerRoleKeys: string[] = req.user!.roles || [];
    const roles = await this.service.listForCaller(req.user!.businessId, callerRoleKeys);
    return ok(res, { roles, count: roles.length }, "Domain roles list");
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    const role = await this.service.getById(req.params.id);
    if (!role) return next({ statusCode: 404, message: "Role not found" });
    if (
      !req.user!.isPlatformSuperAdmin &&
      role.businessId !== null &&
      role.businessId !== req.user!.businessId
    ) {
      return next({ statusCode: 403, message: "Forbidden (tenant)" });
    }
    return ok(res, { role }, "Role details");
  };

  create = async (req: Request, res: Response) => {
    const targetBusinessId =
      req.user!.isPlatformSuperAdmin && req.body.businessId
        ? req.body.businessId
        : req.user!.businessId;
    const role = await this.service.create(targetBusinessId, req.body);
    await AuditLogService.log("CREATE", "role", role.id, null, role, req);
    return ok(res, { role }, "Role created", 201);
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    const callerRoleKeys: string[] = req.user!.roles || [];
    const beforeData = await this.service.getById(req.params.id);
    if (!beforeData) return next({ statusCode: 404, message: "Role not found" });
    const businessId = req.user!.isPlatformSuperAdmin && beforeData.businessId
      ? beforeData.businessId
      : req.user!.businessId;
    const role = await this.service.update(req.params.id, businessId, req.body, callerRoleKeys);
    if (!role) return next({ statusCode: 404, message: "Role not found" });
    await AuditLogService.log("UPDATE", "role", req.params.id, beforeData, role, req);
    return ok(res, { role }, "Role updated");
  };

  duplicate = async (req: Request, res: Response, next: NextFunction) => {
    const source = await this.service.getById(req.params.id);
    if (!source) return next({ statusCode: 404, message: "Role not found" });
    const businessId = req.user!.isPlatformSuperAdmin && req.body.businessId
      ? req.body.businessId
      : source.businessId || req.user!.businessId;
    const role = await this.service.duplicate(req.params.id, businessId, req.body);
    if (!role) return next({ statusCode: 404, message: "Role not found" });
    await AuditLogService.log("DUPLICATE", "role", role.id, source, role, req);
    return ok(res, { role }, "Role duplicated", 201);
  };

  users = async (req: Request, res: Response, next: NextFunction) => {
    const role = await this.service.getById(req.params.id);
    if (!role) return next({ statusCode: 404, message: "Role not found" });
    if (
      !req.user!.isPlatformSuperAdmin &&
      role.businessId !== null &&
      role.businessId !== req.user!.businessId
    ) {
      return next({ statusCode: 403, message: "Forbidden (tenant)" });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const size = Math.min(100, Math.max(1, Number(req.query.size) || 10));
    const search = String(req.query.search || "").trim() || undefined;
    const requestedBusinessId = String(req.query.businessId || "").trim() || undefined;
    const businessId = role.businessId || (
      req.user!.isPlatformSuperAdmin
        ? requestedBusinessId
        : req.user!.businessId
    );

    const data = await this.service.listUsers(req.params.id, businessId, page, size, search);
    if (!data) return next({ statusCode: 404, message: "Role not found" });
    return ok(res, data, "Role users list");
  };

  archive = async (req: Request, res: Response, next: NextFunction) => {
    const callerRoleKeys: string[] = req.user!.roles || [];
    const beforeData = await this.service.getById(req.params.id);
    if (!beforeData) return next({ statusCode: 404, message: "Role not found" });
    const businessId = beforeData.businessId || req.user!.businessId;
    const result = await this.service.archive(req.params.id, businessId, callerRoleKeys);
    if (!result) return next({ statusCode: 404, message: "Role not found" });
    await AuditLogService.log("ARCHIVE", "role", req.params.id, beforeData, null, req);
    return ok(res, result, "Role archived");
  };

  remove = this.archive;
}
