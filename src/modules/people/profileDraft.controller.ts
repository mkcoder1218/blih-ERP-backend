import type { Request, Response, NextFunction } from "express";
import { ok } from "../../utils/apiResponse";
import { AuditLogService } from "../../services/auditLog.service";
import { ProfileDraftService } from "./profileDraft.service";

export class ProfileDraftController {
  private service = new ProfileDraftService();

  list = async (req: Request, res: Response) => {
    const businessId = req.user!.businessId;
    const drafts = await this.service.list(businessId);
    return ok(res, { drafts }, "Profile drafts");
  };

  get = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = req.user!.businessId;
    const draft = await this.service.getById(req.params.id, businessId);
    if (!draft) return next({ statusCode: 404, message: "Not found" });
    return ok(res, { draft }, "Profile draft");
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = req.user!.businessId;
    const createdById = req.user!.id;
    const out = await this.service.create(businessId, createdById, req.body);
    if ((out as any).error) return next((out as any).error);
    const draft = (out as any).draft;
    await AuditLogService.log("CREATE", "profile_draft", draft.id, null, draft, req);
    return ok(res, { draft }, "Profile draft created", 201);
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = req.user!.businessId;
    const before = await this.service.getById(req.params.id, businessId);
    const out = await this.service.update(req.params.id, businessId, req.body);
    if ((out as any).error) return next((out as any).error);
    const draft = (out as any).draft;
    await AuditLogService.log("UPDATE", "profile_draft", req.params.id, before, draft, req);
    return ok(res, { draft }, "Profile draft updated");
  };

  remove = async (req: Request, res: Response, next: NextFunction) => {
    const businessId = req.user!.businessId;
    const before = await this.service.getById(req.params.id, businessId);
    const out = await this.service.remove(req.params.id, businessId);
    if ((out as any).error) return next((out as any).error);
    await AuditLogService.log("DELETE", "profile_draft", req.params.id, before, null, req);
    return ok(res, { ok: true }, "Profile draft deleted");
  };
}

