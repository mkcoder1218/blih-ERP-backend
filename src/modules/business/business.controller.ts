import type { Request, Response, NextFunction } from "express";
import { BusinessService } from "./business.service";
import { AuditLogService } from "../../services/auditLog.service";
import { ok } from "../../utils/apiResponse";

export class BusinessController {
  private service: BusinessService;

  constructor() {
    this.service = new BusinessService();
  }

  list = async (req: Request, res: Response) => {
    const businesses = await this.service.listAll();
    return ok(res, { businesses }, "Businesses");
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    const business = await this.service.getById(req.params.id);
    if (!business) return next({ statusCode: 404, message: "Business not found" });
    return ok(res, { business }, "Business");
  };

  create = async (req: Request, res: Response) => {
    const business = await this.service.create(req.body);
    await AuditLogService.log("CREATE", "business", business.id, null, business, req);
    return ok(res, { business }, "Business created", 201);
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    const beforeData = await this.service.getById(req.params.id);
    const business = await this.service.update(req.params.id, req.body);
    if (!business) return next({ statusCode: 404, message: "Business not found" });
    await AuditLogService.log("UPDATE", "business", req.params.id, beforeData, business, req);
    return ok(res, { business }, "Business updated");
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    const beforeData = await this.service.getById(req.params.id);
    const deleted = await this.service.softDelete(req.params.id);
    if (!deleted) return next({ statusCode: 404, message: "Business not found" });
    await AuditLogService.log("DELETE", "business", req.params.id, beforeData, null, req);
    return ok(res, { ok: true }, "Business deleted");
  };

  /**
   * DELETE /api/v1/businesses/:id/purge
   * Permanently removes the business and ALL associated data.
   * Only callable by PLATFORM_SUPER_ADMIN.
   */
  purge = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const beforeData = await this.service.getById(req.params.id);
      if (!beforeData) return next({ statusCode: 404, message: "Business not found" });

      await this.service.purge(req.params.id);

      await AuditLogService.log("PURGE", "business", req.params.id, beforeData, null, req);
      return ok(res, { ok: true }, "Business and all associated data permanently deleted");
    } catch (e: any) {
      return next({ statusCode: 500, message: e.message });
    }
  };
}
