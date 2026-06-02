import type { Request, Response, NextFunction } from "express";
import { ok } from "../../utils/apiResponse";
import { LateReasonsService } from "./lateReasons.service";

export class LateReasonsController {
  private service = new LateReasonsService();

  list = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const rows = await this.service.list(businessId);
    return ok(res, { reasons: rows }, "Late reasons");
  };

  create = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const createdBy = req.user!.id;
    const row = await this.service.create(businessId, createdBy, req.body);
    return ok(res, { reason: row }, "Late reason created", 201);
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = req.user!.businessId;
    const row = await this.service.update(businessId, req.params.reasonId, req.body);
    if (!row) return next({ statusCode: 404, message: "Late reason not found" });
    return ok(res, { reason: row }, "Late reason updated");
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = req.user!.businessId;
    const row = await this.service.deactivate(businessId, req.params.reasonId);
    if (!row) return next({ statusCode: 404, message: "Late reason not found" });
    return ok(res, { reason: row }, "Late reason deactivated");
  };
}

