import type { NextFunction, Request, Response } from "express";
import { AuditLogService } from "../../services/auditLog.service";
import { TesterService } from "./tester.service";

export class TesterController {
  private service = new TesterService();

  session = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await this.service.session(req.user!.id);
      res.json({ session });
    } catch (error: any) {
      next({ statusCode: error.statusCode || 400, message: error.message });
    }
  };

  list = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const testers = await this.service.list(req.user!.id);
      res.json({ testers });
    } catch (error: any) {
      next({ statusCode: error.statusCode || 400, message: error.message });
    }
  };

  options = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const options = await this.service.options(req.user!.id);
      res.json({ options });
    } catch (error: any) {
      next({ statusCode: error.statusCode || 400, message: error.message });
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.create(req.user!.id, req.body);
      await AuditLogService.log(
        "CREATE_TESTER_ACCOUNT",
        "tester_account",
        String(result.tester?.id || result.tester?.userId || "unknown"),
        null,
        {
          testerUserId: result.tester?.userId,
          testerLevel: result.tester?.testerLevel,
          businessId: result.tester?.user?.businessId,
          roleKeys: result.tester?.user?.roles?.map((role: any) => role.key) || [],
        },
        req,
      );
      res.status(201).json(result);
    } catch (error: any) {
      next({ statusCode: error.statusCode || 400, message: error.message });
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const before = await this.service.list(req.user!.id);
      const current = before.find((row: any) => String(row.userId) === String(req.params.userId)) || null;
      const tester = await this.service.update(req.user!.id, req.params.userId, req.body);
      await AuditLogService.log(
        "UPDATE_TESTER_ACCOUNT",
        "tester_account",
        String(tester?.id || req.params.userId),
        current,
        tester,
        req,
      );
      res.json({ tester });
    } catch (error: any) {
      next({ statusCode: error.statusCode || 400, message: error.message });
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.resetPassword(
        req.user!.id,
        req.params.userId,
        req.body?.password,
      );
      await AuditLogService.log(
        "RESET_TESTER_PASSWORD",
        "tester_account",
        String(result.tester?.id || req.params.userId),
        null,
        { testerUserId: req.params.userId, passwordReset: true },
        req,
        "warning",
      );
      res.json(result);
    } catch (error: any) {
      next({ statusCode: error.statusCode || 400, message: error.message });
    }
  };
}
