import type { Request, Response, NextFunction } from "express";
import { UserService } from "./user.service";
import { AuditLogService } from "../../services/auditLog.service";

export class UserController {
  private service: UserService;

  constructor() {
    this.service = new UserService();
  }

  list = async (req: Request, res: Response) => {
    const search = (req.query.search as string) || "";
    const page = parseInt(req.query.page as string) || 1;
    const size = parseInt(req.query.size as string) || 20;
    const permission = (req.query.permission as string) || "";
    
    const result = await this.service.list(req.user!.businessId, search, page, size, permission);
    res.json(result);
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    const user = await this.service.getById(req.params.id, req.user!.businessId);
    if (!user) return next({ statusCode: 404, message: "User not found" });
    res.json({ user });
  };

  create = async (req: Request, res: Response) => {
    const user = await this.service.create(req.user, req.body);
    await AuditLogService.log("CREATE", "user", user.id, null, user, req);
    res.status(201).json({ user });
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    const beforeData = await this.service.getById(req.params.id, req.user!.businessId);
    const user = await this.service.update(req.params.id, req.user, req.body);
    if (!user) return next({ statusCode: 404, message: "User not found" });
    await AuditLogService.log("UPDATE", "user", req.params.id, beforeData, user, req);
    res.json({ user });
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    const beforeData = await this.service.getById(req.params.id, req.user!.businessId);
    const ok = await this.service.softDelete(req.params.id, req.user);
    if (!ok) return next({ statusCode: 404, message: "User not found" });
    await AuditLogService.log("DELETE", "user", req.params.id, beforeData, null, req);
    res.json({ ok: true });
  };
}

