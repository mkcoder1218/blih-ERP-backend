import type { Request, Response, NextFunction } from "express";
import { ok } from "../../utils/apiResponse";
import { AuditLogService } from "../../services/auditLog.service";
import { SectorFocusService } from "./sectorFocus.service";

export class SectorFocusController {
  private service = new SectorFocusService();

  list = async (_req: Request, res: Response) => {
    const sectorFocuses = await this.service.list();
    return ok(res, { sectorFocuses }, "Sector focuses");
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    const sectorFocus = await this.service.getById(req.params.id);
    if (!sectorFocus) return next({ statusCode: 404, message: "Sector focus not found" });
    return ok(res, { sectorFocus }, "Sector focus");
  };

  create = async (req: Request, res: Response) => {
    const sectorFocus = await this.service.create(req.body);
    await AuditLogService.log("CREATE", "sector_focus", sectorFocus.id, null, sectorFocus, req);
    return ok(res, { sectorFocus }, "Sector focus created", 201);
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    const beforeData = await this.service.getById(req.params.id);
    const sectorFocus = await this.service.update(req.params.id, req.body);
    if (!sectorFocus) return next({ statusCode: 404, message: "Sector focus not found" });
    await AuditLogService.log("UPDATE", "sector_focus", req.params.id, beforeData, sectorFocus, req);
    return ok(res, { sectorFocus }, "Sector focus updated");
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    const beforeData = await this.service.getById(req.params.id);
    const deleted = await this.service.remove(req.params.id);
    if (!deleted) return next({ statusCode: 404, message: "Sector focus not found" });
    await AuditLogService.log("DELETE", "sector_focus", req.params.id, beforeData, null, req);
    return ok(res, { ok: true }, "Sector focus deleted");
  };
}

