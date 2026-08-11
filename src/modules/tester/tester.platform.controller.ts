import type { NextFunction, Request, Response } from "express";
import { AuditLogService } from "../../services/auditLog.service";
import { PlatformMasterTesterService } from "./tester.platform.service";

export class PlatformMasterTesterController {
  private service = new PlatformMasterTesterService();

  options = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const options = await this.service.options(req.user!.id);
      res.json({ options });
    } catch (error: any) {
      next({ statusCode: error.statusCode || 400, message: error.message });
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const masters = await this.service.list(req.user!.id);
      res.json({ masters });
    } catch (error: any) {
      next({ statusCode: error.statusCode || 400, message: error.message });
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.create(req.user!.id, req.body);

      await AuditLogService.log(
        "CREATE_MASTER_TESTER_ACCOUNT",
        "tester_account",
        String(result.tester?.id || result.tester?.userId || "unknown"),
        null,
        {
          testerUserId: result.tester?.userId,
          testerLevel: "MASTER",
          businessId: result.tester?.user?.businessId,
          createdByPlatformAdminUserId: req.user!.id,
        },
        req,
        "warning",
      );

      res.status(201).json(result);
    } catch (error: any) {
      next({ statusCode: error.statusCode || 400, message: error.message });
    }
  };
}
